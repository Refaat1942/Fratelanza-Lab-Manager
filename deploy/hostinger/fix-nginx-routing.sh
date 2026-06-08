#!/bin/bash
# Fix: labmaster.fratelanza.com showing Fratelanza Hub instead of LabMaster
#
# Root cause: Your Fratelanza project has a wildcard/catch-all nginx config
# that catches labmaster BEFORE LabMaster's config, OR HTTPS has no labmaster
# SSL block so it falls to Fratelanza's default certificate.
#
# This script ONLY creates/fixes /etc/nginx/sites-available/labmaster
# It does NOT edit your Fratelanza or other project configs.
#
# Usage:
#   cd /opt/labmaster && sudo bash deploy/hostinger/fix-nginx-routing.sh labmaster.fratelanza.com

set -e

DOMAIN="${1:-labmaster.fratelanza.com}"
INSTALL_DIR="${LABMASTER_DIR:-/opt/labmaster}"
NGINX_SITE="labmaster"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"
WEB_PORT="${LABMASTER_WEB_PORT:-13000}"
API_PORT="${LABMASTER_API_PORT:-18000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[FIX]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Run as root: sudo bash $0 $DOMAIN"

echo ""
echo "=========================================="
echo " LabMaster Nginx Routing Fix"
echo " Domain: $DOMAIN"
echo "=========================================="
echo ""

# --- Step 1: Diagnose ---
info "Step 1: Diagnosing..."

if [ -f "$INSTALL_DIR/.env.production" ]; then
    # shellcheck disable=SC1090
    source <(grep -E '^LABMASTER_' "$INSTALL_DIR/.env.production" | sed 's/^/export /')
    WEB_PORT="${LABMASTER_WEB_PORT:-13000}"
    API_PORT="${LABMASTER_API_PORT:-18000}"
fi

info "LabMaster containers:"
docker ps --filter "name=labmaster" --format "  {{.Names}}: {{.Status}}" 2>/dev/null || warn "Docker not running"

info "Direct port test (should return LabMaster, not Fratelanza):"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${WEB_PORT}/" 2>/dev/null || echo "000")
echo "  http://127.0.0.1:${WEB_PORT}/ → HTTP $HTTP_CODE"
if [ "$HTTP_CODE" = "000" ]; then
    warn "LabMaster frontend not running on port $WEB_PORT!"
    warn "Run: cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml --env-file .env.production up -d"
fi

info "Current nginx sites:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true

info "Checking for wildcard configs that may steal $DOMAIN:"
FOUND_WILDCARD=0
for f in /etc/nginx/sites-enabled/*; do
    [ -f "$f" ] || continue
    [ "$(basename "$f")" = "$NGINX_SITE" ] && continue
    if grep -qE 'server_name.*\*\.|server_name.*\.fratelanza\.com|default_server' "$f" 2>/dev/null; then
        warn "  $(basename "$f") has wildcard/catch-all:"
        grep -E 'server_name|default_server' "$f" | head -3 | sed 's/^/    /'
        FOUND_WILDCARD=1
    fi
done

if [ "$FOUND_WILDCARD" -eq 1 ]; then
    echo ""
    warn "Your Fratelanza project uses a wildcard nginx config."
    warn "Fix: LabMaster needs its OWN server block with exact server_name."
    warn "This script creates that — without editing Fratelanza files."
    echo ""
fi

info "Testing what nginx currently serves for $DOMAIN:"
CURRENT=$(curl -s -H "Host: $DOMAIN" "http://127.0.0.1/" 2>/dev/null | head -c 200)
if echo "$CURRENT" | grep -qi "fratelanza\|Fratelanza Hub\|Manage your business"; then
    warn "CONFIRMED: nginx is routing $DOMAIN to Fratelanza, NOT LabMaster!"
elif echo "$CURRENT" | grep -qi "LabMaster\|labmaster\|Laboratory"; then
    info "HTTP routing looks correct already."
else
    warn "Could not determine routing. Body preview: ${CURRENT:0:80}..."
fi

# --- Step 2: Write dedicated LabMaster nginx config ---
info "Step 2: Writing dedicated nginx config..."

SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
HAS_SSL=false
[ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ] && HAS_SSL=true

cat > "$NGINX_AVAILABLE" << NGINX_EOF
# LabMaster Egypt — ISOLATED nginx site
# Domain: ${DOMAIN}
# DO NOT merge with Fratelanza config

# HTTP → HTTPS redirect (when SSL exists)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS — LabMaster only
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};

    # Fallback self-signed won't work — certbot must run first for HTTPS
    # If no cert yet, comment out HTTPS block and use HTTP-only below

    client_max_body_size 50M;

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /docs {
        return 404;
    }

    location /redoc {
        return 404;
    }

    location /health {
        proxy_pass http://127.0.0.1:${API_PORT}/health;
    }

    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_EOF

# If no SSL cert yet, write HTTP-only config instead
if [ "$HAS_SSL" = false ]; then
    warn "No SSL cert found yet. Writing HTTP-only config first."
    cat > "$NGINX_AVAILABLE" << NGINX_EOF
# LabMaster Egypt — ISOLATED nginx site (HTTP only until SSL is issued)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    client_max_body_size 50M;

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /docs {
        return 404;
    }

    location /health {
        proxy_pass http://127.0.0.1:${API_PORT}/health;
    }

    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_EOF
fi

ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
mkdir -p /var/www/certbot

info "Step 3: Testing nginx config..."
if ! nginx -t 2>&1; then
    error "Nginx config invalid. Check: $NGINX_AVAILABLE"
fi

systemctl reload nginx
info "Nginx reloaded."

# --- Step 3: Verify HTTP routing ---
info "Step 4: Verifying routing..."
sleep 1
VERIFY=$(curl -s -H "Host: $DOMAIN" "http://127.0.0.1/" 2>/dev/null | head -c 300)
if echo "$VERIFY" | grep -qi "LabMaster\|Laboratory Login\|labmaster"; then
    echo -e "${GREEN}SUCCESS: $DOMAIN now routes to LabMaster on HTTP!${NC}"
elif [ "$HAS_SSL" = false ]; then
    warn "Still not routing correctly. Checking nginx -T for server_name conflicts..."
    nginx -T 2>/dev/null | grep -A2 "server_name.*${DOMAIN}" || true
    echo ""
    warn "Try: curl -v -H 'Host: ${DOMAIN}' http://127.0.0.1/"
else
    info "HTTP redirects to HTTPS. Test: curl -k https://${DOMAIN}/"
fi

# --- Step 4: SSL if missing ---
if [ "$HAS_SSL" = false ]; then
    echo ""
    info "Step 5: Issuing SSL certificate (certonly — won't touch Fratelanza config)..."
    apt-get install -y -qq certbot 2>/dev/null || true

    if certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
        --non-interactive --agree-tos --register-unsafely-without-email 2>&1; then
        info "SSL certificate issued! Re-running fix to enable HTTPS..."
        exec "$0" "$DOMAIN"
    else
        echo ""
        warn "SSL failed. You can still use HTTP:"
        echo "  http://${DOMAIN}"
        echo ""
        warn "For HTTPS, run manually:"
        echo "  certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN}"
        echo "  sudo bash $0 ${DOMAIN}"
    fi
fi

# --- Rebuild frontend with correct API URL ---
if [ -d "$INSTALL_DIR" ]; then
    info "Rebuilding LabMaster frontend..."
    cd "$INSTALL_DIR"
    PROTO="https"
    [ "$HAS_SSL" = false ] && PROTO="http"
    sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=${PROTO}://${DOMAIN}/api/v1|" .env.production 2>/dev/null || true
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build frontend 2>/dev/null || true
fi

echo ""
echo "=========================================="
echo -e "${GREEN} DONE ${NC}"
echo "=========================================="
echo ""
echo "  LabMaster:  https://${DOMAIN}"
echo "  Platform:   https://${DOMAIN}/platform/login"
echo "  API Docs:   disabled in production"
echo ""
echo "  Login: use the administrator credentials provisioned in .env.production"
echo ""
echo "  Fratelanza Hub is UNCHANGED at its own domain."
echo ""
