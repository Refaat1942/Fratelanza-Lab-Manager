#!/bin/bash
# LabMaster EMERGENCY rescue — fixes wrong project (Fratelanza) + broken SSL
# Run on VPS as root:
#   curl -fsSL https://raw.githubusercontent.com/Refaat1942/Fratelanza-Lab-Manager/main/deploy/hostinger/rescue-labmaster.sh | sudo bash -s -- labmaster.fratelanza.com

set -e

DOMAIN="${1:-labmaster.fratelanza.com}"
INSTALL_DIR="${LABMASTER_DIR:-/opt/labmaster}"
WEB_PORT="${LABMASTER_WEB_PORT:-13000}"
API_PORT="${LABMASTER_API_PORT:-18000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
die()  { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root: sudo bash $0 $DOMAIN"

echo ""
echo "=========================================="
echo " LabMaster RESCUE — $DOMAIN"
echo "=========================================="
echo ""

# --- Load ports from .env ---
if [ -f "$INSTALL_DIR/.env.production" ]; then
    # shellcheck disable=SC1090
    source <(grep -E '^LABMASTER_' "$INSTALL_DIR/.env.production" | sed 's/^/export /')
    WEB_PORT="${LABMASTER_WEB_PORT:-13000}"
    API_PORT="${LABMASTER_API_PORT:-18000}"
fi

# --- 1. Start LabMaster containers ---
ok "Step 1: Starting LabMaster containers..."
if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build 2>/dev/null || \
        docker compose -f docker-compose.prod.yml --env-file .env.production up -d
    sleep 5
else
    die "LabMaster not found at $INSTALL_DIR. Run deploy.sh first."
fi

HEALTH=$(curl -sf "http://127.0.0.1:${API_PORT}/health" 2>/dev/null || echo "FAIL")
[ "$HEALTH" != "FAIL" ] && ok "API healthy on port $API_PORT" || warn "API not responding on $API_PORT — check: docker compose logs backend"

# --- 2. HTTP-only nginx (with acme-challenge) — NEVER touch Fratelanza files ---
ok "Step 2: Writing dedicated LabMaster nginx (HTTP only for now)..."
NGINX_FILE="/etc/nginx/sites-available/labmaster"
mkdir -p /var/www/certbot

cat > "$NGINX_FILE" << EOF
# LabMaster RESCUE — isolated site for ${DOMAIN}
# Does NOT modify Fratelanza or other projects

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
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
        proxy_pass http://127.0.0.1:${API_PORT}/docs;
        proxy_set_header Host \$host;
    }

    location /redoc {
        proxy_pass http://127.0.0.1:${API_PORT}/redoc;
        proxy_set_header Host \$host;
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
EOF

ln -sf "$NGINX_FILE" /etc/nginx/sites-enabled/labmaster
nginx -t || die "Nginx config invalid — run: nginx -t"
systemctl reload nginx
ok "Nginx reloaded"

# --- 3. Verify HTTP routing ---
ok "Step 3: Verifying HTTP routes to LabMaster..."
BODY=$(curl -s -H "Host: ${DOMAIN}" "http://127.0.0.1/" 2>/dev/null | head -c 300)
if echo "$BODY" | grep -qiE "LabMaster|Laboratory|labmaster|login"; then
    ok "HTTP routing is CORRECT (LabMaster)"
elif echo "$BODY" | grep -qiE "fratelanza|Fratelanza Hub"; then
    warn "HTTP still shows Fratelanza!"
    warn "Another nginx site has higher priority. Checking..."
    nginx -T 2>/dev/null | grep -B1 -A3 "server_name.*${DOMAIN}" || true
    warn "Try moving labmaster link first: sudo ln -sf $NGINX_FILE /etc/nginx/sites-enabled/00-labmaster"
    ln -sf "$NGINX_FILE" /etc/nginx/sites-enabled/00-labmaster
    rm -f /etc/nginx/sites-enabled/labmaster
    nginx -t && systemctl reload nginx
    BODY=$(curl -s -H "Host: ${DOMAIN}" "http://127.0.0.1/" 2>/dev/null | head -c 300)
    echo "  After rename: ${BODY:0:120}..."
else
    warn "Unexpected response: ${BODY:0:120}..."
fi

# Test acme challenge path
echo test > /var/www/certbot/.well-known/acme-challenge/rescue-test 2>/dev/null || \
    mkdir -p /var/www/certbot/.well-known/acme-challenge && echo test > /var/www/certbot/.well-known/acme-challenge/rescue-test
ACME=$(curl -s -H "Host: ${DOMAIN}" "http://127.0.0.1/.well-known/acme-challenge/rescue-test" 2>/dev/null)
[ "$ACME" = "test" ] && ok "ACME challenge path works" || warn "ACME path broken — certbot will fail"

echo ""
ok ">>> TEST NOW IN BROWSER (HTTP): http://${DOMAIN}/login"
echo ""

# --- 4. SSL certificate ---
DO_SSL="${RESCUE_SSL:-ask}"
if [ "$DO_SSL" = "ask" ] && [ -t 0 ]; then
    read -rp "Issue SSL certificate now? (y/N): " REPLY_SSL
    [[ "$REPLY_SSL" =~ ^[Yy]$ ]] && DO_SSL=yes || DO_SSL=no
elif [ "$DO_SSL" = "ask" ]; then
    DO_SSL=yes
fi

if [[ "$DO_SSL" =~ ^(y|yes|1)$ ]]; then
    ok "Step 4: Cleaning certbot state..."
    rm -rf /var/lib/letsencrypt/temp_checkpoint
    rm -rf /var/lib/letsencrypt/backups/* 2>/dev/null || true

    apt-get install -y -qq certbot 2>/dev/null || true

    ok "Requesting certificate (webroot — safe, won't edit Fratelanza)..."
    if certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
        --non-interactive --agree-tos --register-unsafely-without-email --force-renewal 2>&1; then

        SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
        SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

        ok "Certificate issued! Enabling HTTPS..."

        cat > "$NGINX_FILE" << EOF
# LabMaster — ${DOMAIN} (HTTP redirect + HTTPS)

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

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};

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
        proxy_pass http://127.0.0.1:${API_PORT}/docs;
        proxy_set_header Host \$host;
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
EOF
        nginx -t && systemctl reload nginx
        ok "HTTPS enabled"

        cd "$INSTALL_DIR"
        sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://${DOMAIN}/api/v1|" .env.production
        sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=[\"https://${DOMAIN}\"]|" .env.production
        grep -q "^LABMASTER_DOMAIN=" .env.production && \
            sed -i "s|^LABMASTER_DOMAIN=.*|LABMASTER_DOMAIN=${DOMAIN}|" .env.production || \
            echo "LABMASTER_DOMAIN=${DOMAIN}" >> .env.production

        ok "Rebuilding frontend..."
        docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build frontend

        echo ""
        ok ">>> OPEN: https://${DOMAIN}/login"
    else
        warn "SSL failed. Use HTTP for now: http://${DOMAIN}/login"
        warn "Log: tail -30 /var/log/letsencrypt/letsencrypt.log"
    fi
else
    warn "Skipped SSL. Use HTTP: http://${DOMAIN}/login"
fi

echo ""
echo "=========================================="
echo -e "${GREEN} RESCUE COMPLETE ${NC}"
echo "=========================================="
echo ""
echo "  Lab:      http://${DOMAIN}/login"
echo "  Platform: http://${DOMAIN}/platform/login"
echo "  API:      http://${DOMAIN}/health"
echo ""
echo "  Login: labadmin / Demo@123  (tenant: demo-lab)"
echo "  Platform: superadmin / Admin@123"
echo ""
echo "  Fratelanza is UNTOUCHED on its own domain."
echo ""
