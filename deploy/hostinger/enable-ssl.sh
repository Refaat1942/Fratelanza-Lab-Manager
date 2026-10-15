#!/bin/bash
# LabMaster Egypt — Enable HTTPS for LabMaster subdomain ONLY
# Uses certbot certonly (webroot) — does NOT run certbot --nginx (won't touch Fratelanza)
#
# Usage:
#   sudo bash deploy/hostinger/enable-ssl.sh labmaster.yourdomain.com

set -e

DOMAIN="${1:-}"
INSTALL_DIR="${LABMASTER_DIR:-/opt/labmaster}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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

echo "[LabMaster] Issuing SSL for: $DOMAIN (isolated — Fratelanza untouched)"
echo ""

if ! command -v certbot &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq certbot
fi

mkdir -p /var/www/certbot/.well-known/acme-challenge
bash "$SCRIPT_DIR/apply-labmaster-nginx.sh" "$DOMAIN"

rm -rf /var/lib/letsencrypt/temp_checkpoint 2>/dev/null || true

certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email || \
    certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN"

echo ""
echo "[LabMaster] Applying HTTPS nginx block..."
bash "$SCRIPT_DIR/apply-labmaster-nginx.sh" "$DOMAIN"

echo "[LabMaster] Updating .env.production to HTTPS..."
cd "$INSTALL_DIR"
sed -i "s|http://${DOMAIN}|https://${DOMAIN}|g" .env.production
sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=[\"https://${DOMAIN}\"]|" .env.production

echo "[LabMaster] Rebuilding frontend..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build frontend

echo ""
echo "HTTPS enabled: https://${DOMAIN}"
echo "API: https://${DOMAIN}/api/v1"
