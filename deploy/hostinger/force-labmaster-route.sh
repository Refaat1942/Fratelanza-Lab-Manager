#!/bin/bash
# FORCE labmaster.fratelanza.com → LabMaster (when Fratelanza steals HTTP/HTTPS)
# Run: sudo bash /opt/labmaster/deploy/hostinger/force-labmaster-route.sh labmaster.fratelanza.com

set -e
DOMAIN="${1:-labmaster.fratelanza.com}"
INSTALL_DIR="${LABMASTER_DIR:-/opt/labmaster}"
WEB_PORT="${LABMASTER_WEB_PORT:-13000}"
API_PORT="${LABMASTER_API_PORT:-18000}"

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

if [ -f "$INSTALL_DIR/.env.production" ]; then
    source <(grep -E '^LABMASTER_' "$INSTALL_DIR/.env.production" | sed 's/^/export /')
    WEB_PORT="${LABMASTER_WEB_PORT:-13000}"
    API_PORT="${LABMASTER_API_PORT:-18000}"
fi

echo "========== DIAGNOSE =========="
echo "Port ${WEB_PORT} (must say LabMaster):"
curl -sL "http://127.0.0.1:${WEB_PORT}/login" 2>/dev/null | grep -oiE "LabMaster|Fratelanza|Laboratory" | head -3 || echo "(no match)"
echo ""
echo "Who owns '${DOMAIN}' in nginx configs:"
grep -rn "server_name" /etc/nginx/sites-enabled/ 2>/dev/null | grep -i "labmaster\|fratelanza\|\*" || true
echo ""
echo "Nginx test:"
nginx -t
echo ""

# Stop duplicate labmaster links
rm -f /etc/nginx/sites-enabled/labmaster
rm -f /etc/nginx/sites-enabled/00-labmaster

mkdir -p /var/www/certbot/.well-known/acme-challenge

SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
HAS_SSL=false
[ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ] && HAS_SSL=true

NGINX_FILE="/etc/nginx/sites-available/labmaster"

if [ "$HAS_SSL" = true ]; then
    echo "Using existing Let's Encrypt cert."
    cat > "$NGINX_FILE" << EOF
# LabMaster FORCE ROUTE — ${DOMAIN}
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
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
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location /health { proxy_pass http://127.0.0.1:${API_PORT}/health; }
    location /docs { proxy_pass http://127.0.0.1:${API_PORT}/docs; proxy_set_header Host \$host; }
    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
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
    echo "No SSL cert yet — HTTP only (use http:// NOT https:// in browser)."
    cat > "$NGINX_FILE" << EOF
# LabMaster FORCE ROUTE — ${DOMAIN} (HTTP until SSL issued)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    client_max_body_size 50M;
    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location /health { proxy_pass http://127.0.0.1:${API_PORT}/health; }
    location /docs { proxy_pass http://127.0.0.1:${API_PORT}/docs; proxy_set_header Host \$host; }
    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
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

ln -sf "$NGINX_FILE" /etc/nginx/sites-enabled/00-labmaster
nginx -t
systemctl reload nginx

echo ""
echo "========== VERIFY =========="
echo "Local HTTP:"
curl -sL -H "Host: ${DOMAIN}" "http://127.0.0.1/login" 2>/dev/null | grep -oiE "LabMaster|Fratelanza|Laboratory" | head -3
echo ""
if [ "$HAS_SSL" = true ]; then
    echo "Local HTTPS:"
    curl -skL "https://${DOMAIN}/login" 2>/dev/null | grep -oiE "LabMaster|Fratelanza|Laboratory" | head -3
    echo ""
    echo "OPEN: https://${DOMAIN}/login"
else
    echo ">>> OPEN THIS (HTTP only): http://${DOMAIN}/login"
    echo ""
    echo "To get HTTPS, run:"
    echo "  certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN}"
    echo "  sudo bash $0 ${DOMAIN}"
fi
echo ""

# Rebuild frontend API URL
if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
    if [ "$HAS_SSL" = true ]; then
        sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://${DOMAIN}/api/v1|" .env.production
        sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=[\"https://${DOMAIN}\"]|" .env.production
    else
        sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://${DOMAIN}/api/v1|" .env.production
        sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=[\"http://${DOMAIN}\"]|" .env.production
    fi
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build frontend 2>/dev/null || true
fi
