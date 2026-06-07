#!/bin/bash
# LabMaster Egypt — Enable HTTPS for LabMaster subdomain only
# Certbot will ONLY modify the labmaster nginx site, not your other projects.
#
# Usage:
#   sudo bash deploy/hostinger/enable-ssl.sh labmaster.yourdomain.com

set -e

DOMAIN="${1:-}"
INSTALL_DIR="${LABMASTER_DIR:-/opt/labmaster}"

if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root: sudo bash $0 labmaster.yourdomain.com"
    exit 1
fi

if [ -z "$DOMAIN" ]; then
    if [ -f "$INSTALL_DIR/.env.production" ]; then
        DOMAIN=$(grep "^LABMASTER_DOMAIN=" "$INSTALL_DIR/.env.production" | cut -d= -f2)
    fi
fi

if [ -z "$DOMAIN" ]; then
    read -rp "Enter LabMaster domain: " DOMAIN
fi

echo "[LabMaster] Issuing SSL certificate for: $DOMAIN"
echo "[LabMaster] This only affects the labmaster nginx site."
echo ""

# Install certbot if missing
if ! command -v certbot &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq certbot python3-certbot-nginx
fi

certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
    certbot --nginx -d "$DOMAIN"

echo ""
echo "[LabMaster] Updating .env.production to HTTPS..."
cd "$INSTALL_DIR"
sed -i "s|http://${DOMAIN}|https://${DOMAIN}|g" .env.production

echo "[LabMaster] Rebuilding frontend..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build frontend

echo ""
echo "HTTPS enabled: https://${DOMAIN}"
echo "API: https://${DOMAIN}/api/v1"
