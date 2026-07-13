#!/bin/bash
# Fix: labmaster subdomain showing Fratelanza instead of LabMaster
#
# Root cause: HTTPS (443) had no LabMaster server block — Fratelanza's SSL caught the domain.
# This script ONLY writes /etc/nginx/sites-available/labmaster (isolated).
# It does NOT edit Fratelanza or other project configs.
#
# Usage:
#   cd /opt/labmaster && sudo bash deploy/hostinger/fix-nginx-routing.sh labmaster.fratelanza.com

set -e

DOMAIN="${1:-labmaster.fratelanza.com}"
INSTALL_DIR="${LABMASTER_DIR:-/opt/labmaster}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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

info "Diagnosing HTTP vs HTTPS routing..."
echo "  HTTP:  $(curl -sL -H "Host: $DOMAIN" http://127.0.0.1/login 2>/dev/null | grep -oiE 'LabMaster|Fratelanza' | head -1 || echo '?')"
echo "  HTTPS: $(curl -skL "https://${DOMAIN}/login" 2>/dev/null | grep -oiE 'LabMaster|Fratelanza' | head -1 || echo '?')"
echo ""

SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [ ! -f "$SSL_CERT" ]; then
    warn "No SSL certificate yet. Issuing via webroot (safe — won't edit Fratelanza)..."
    mkdir -p /var/www/certbot/.well-known/acme-challenge
    bash "$SCRIPT_DIR/apply-labmaster-nginx.sh" "$DOMAIN"
    apt-get install -y -qq certbot 2>/dev/null || true
    rm -rf /var/lib/letsencrypt/temp_checkpoint 2>/dev/null || true
    certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
        --non-interactive --agree-tos --register-unsafely-without-email || \
        warn "SSL issuance failed — HTTP will still work. See /var/log/letsencrypt/letsencrypt.log"
fi

info "Applying isolated LabMaster nginx config..."
bash "$SCRIPT_DIR/apply-labmaster-nginx.sh" "$DOMAIN"

if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
    PROTO="https"
    [ -f "$SSL_CERT" ] || PROTO="http"
    sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=${PROTO}://${DOMAIN}/api/v1|" .env.production 2>/dev/null || true
    sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=[\"${PROTO}://${DOMAIN}\"]|" .env.production 2>/dev/null || true
    grep -q "^LABMASTER_DOMAIN=" .env.production && \
        sed -i "s|^LABMASTER_DOMAIN=.*|LABMASTER_DOMAIN=${DOMAIN}|" .env.production || \
        echo "LABMASTER_DOMAIN=${DOMAIN}" >> .env.production
    info "Rebuilding frontend..."
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build frontend 2>/dev/null || true
fi

echo ""
echo "=========================================="
echo -e "${GREEN} DONE — LabMaster isolated at 00-labmaster${NC}"
echo "=========================================="
echo ""
echo "  https://${DOMAIN}/login"
echo "  https://${DOMAIN}/platform/login"
echo ""
echo "  Fratelanza configs were NOT modified."
echo ""
