#!/bin/bash
# Canonical ISOLATED LabMaster nginx config (proven production fix).
# Writes ONLY: /etc/nginx/sites-available/labmaster
# Enables ONLY: /etc/nginx/sites-enabled/00-labmaster
# Never edits Fratelanza, pharmapos, or any other nginx site.
#
# Usage:
#   sudo bash deploy/hostinger/apply-labmaster-nginx.sh labmaster.fratelanza.com

set -e

DOMAIN="${1:-}"
INSTALL_DIR="${LABMASTER_DIR:-/opt/labmaster}"
NGINX_AVAILABLE="/etc/nginx/sites-available/labmaster"
NGINX_ENABLED="/etc/nginx/sites-enabled/00-labmaster"
WEB_PORT="${LABMASTER_WEB_PORT:-13000}"
API_PORT="${LABMASTER_API_PORT:-18000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

die() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
ok()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

[ "$(id -u)" -eq 0 ] || die "Run as root: sudo bash $0 <domain>"

if [ -z "$DOMAIN" ]; then
    [ -f "$INSTALL_DIR/.env.production" ] && \
        DOMAIN=$(grep "^LABMASTER_DOMAIN=" "$INSTALL_DIR/.env.production" | cut -d= -f2)
fi
[ -n "$DOMAIN" ] || die "Domain required. Example: sudo bash $0 labmaster.fratelanza.com"

if [ -f "$INSTALL_DIR/.env.production" ]; then
    # shellcheck disable=SC1090
    source <(grep -E '^LABMASTER_' "$INSTALL_DIR/.env.production" | sed 's/^/export /')
    WEB_PORT="${LABMASTER_WEB_PORT:-13000}"
    API_PORT="${LABMASTER_API_PORT:-18000}"
fi

SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
HAS_SSL=false
[ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ] && HAS_SSL=true

mkdir -p /var/www/certbot/.well-known/acme-challenge

ok "Writing isolated LabMaster nginx for: $DOMAIN (SSL: $HAS_SSL)"
ok "Ports: frontend=$WEB_PORT api=$API_PORT"

if [ "$HAS_SSL" = true ]; then
    cat > "$NGINX_AVAILABLE" << EOF
# =============================================================================
# LabMaster Egypt — ISOLATED nginx site (DO NOT MERGE WITH OTHER PROJECTS)
# Domain: ${DOMAIN}
# Managed by: deploy/hostinger/apply-labmaster-nginx.sh
# =============================================================================

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

    location /health {
        proxy_pass http://127.0.0.1:${API_PORT}/health;
    }

    location /docs {
        proxy_pass http://127.0.0.1:${API_PORT}/docs;
        proxy_set_header Host \$host;
    }

    location /redoc {
        proxy_pass http://127.0.0.1:${API_PORT}/redoc;
        proxy_set_header Host \$host;
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
else
    warn "No SSL cert yet — HTTP only. Use http://${DOMAIN}/ until certbot runs."
    cat > "$NGINX_AVAILABLE" << EOF
# =============================================================================
# LabMaster Egypt — ISOLATED nginx site (HTTP only until SSL is issued)
# Domain: ${DOMAIN}
# Managed by: deploy/hostinger/apply-labmaster-nginx.sh
# =============================================================================

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

    location /health {
        proxy_pass http://127.0.0.1:${API_PORT}/health;
    }

    location /docs {
        proxy_pass http://127.0.0.1:${API_PORT}/docs;
        proxy_set_header Host \$host;
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
fi

rm -f /etc/nginx/sites-enabled/labmaster
ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"

nginx -t || die "Invalid nginx config at $NGINX_AVAILABLE"
systemctl reload nginx
ok "Enabled: $NGINX_ENABLED -> $NGINX_AVAILABLE"
ok "Other nginx sites (Fratelanza, etc.) were NOT modified."

echo ""
echo "Verify:"
echo "  curl -skL https://${DOMAIN}/login | grep -oiE 'LabMaster|Fratelanza' | head -1"
echo ""
