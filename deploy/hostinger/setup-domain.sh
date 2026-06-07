#!/bin/bash
# LabMaster Egypt — Connect a subdomain to your domain
# SAFE: Adds ONE new nginx site file. Does NOT edit your existing projects.
#
# Usage:
#   sudo bash deploy/hostinger/setup-domain.sh labmaster.yourdomain.com
#
# Recommended: use a SUBDOMAIN (labmaster.*, lab.*) — never the root domain
# if you already host other projects on it.

set -e

INSTALL_DIR="${LABMASTER_DIR:-/opt/labmaster}"
DOMAIN="${1:-}"
NGINX_SITE="labmaster"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[LabMaster]${NC} $1"; }
warn()  { echo -e "${YELLOW}[Warning]${NC} $1"; }
error() { echo -e "${RED}[Error]${NC} $1"; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
    error "Run as root: sudo bash $0 labmaster.yourdomain.com"
fi

if [ -z "$DOMAIN" ]; then
    echo ""
    echo "LabMaster Domain Setup (safe — won't touch existing projects)"
    echo "=============================================================="
    echo ""
    read -rp "Enter subdomain for LabMaster (e.g. labmaster.yourdomain.com): " DOMAIN
fi

if [ -z "$DOMAIN" ]; then
    error "Domain is required. Example: labmaster.yourdomain.com"
fi

# Warn if using root domain
if [[ "$DOMAIN" != *.*.* ]]; then
    warn "You entered what looks like a root domain ($DOMAIN)."
    warn "If other projects use this domain, use a SUBDOMAIN instead:"
    warn "  labmaster.yourdomain.com  or  lab.yourdomain.com"
    read -rp "Continue anyway? (y/N): " CONFIRM
    [[ "$CONFIRM" =~ ^[Yy]$ ]] || exit 0
fi

if [ ! -d "$INSTALL_DIR" ]; then
    error "LabMaster not found at $INSTALL_DIR. Run deploy.sh first."
fi

cd "$INSTALL_DIR"

# Load ports from .env.production
ENV_FILE="$INSTALL_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
    error ".env.production not found. Run deploy.sh first."
fi

# shellcheck disable=SC1090
source <(grep -E '^LABMASTER_|^POSTGRES_' "$ENV_FILE" | sed 's/^/export /')

WEB_PORT="${LABMASTER_WEB_PORT:-13000}"
API_PORT="${LABMASTER_API_PORT:-18000}"

info "Checking LabMaster containers are running..."
if ! curl -sf "http://127.0.0.1:${API_PORT}/health" > /dev/null 2>&1; then
    warn "Backend not responding on port $API_PORT. Starting containers..."
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d
    sleep 5
fi

info "Checking domain is not already used by another nginx site..."
if [ -d /etc/nginx/sites-enabled ]; then
    for f in /etc/nginx/sites-enabled/*; do
        [ -f "$f" ] || continue
        [ "$(basename "$f")" = "$NGINX_SITE" ] && continue
        if grep -q "server_name.*${DOMAIN}" "$f" 2>/dev/null; then
            error "Domain $DOMAIN is already configured in $(basename "$f"). Use a different subdomain."
        fi
    done
fi

# Warn about wildcard configs (common cause of routing to wrong project)
for f in /etc/nginx/sites-enabled/*; do
    [ -f "$f" ] || continue
    [ "$(basename "$f")" = "$NGINX_SITE" ] && continue
    if grep -qE 'server_name.*\*\.|server_name.*\.fratelanza' "$f" 2>/dev/null; then
        warn "Found wildcard in $(basename "$f") — may steal $DOMAIN on HTTPS!"
        warn "After setup, run: sudo bash deploy/hostinger/fix-nginx-routing.sh $DOMAIN"
    fi
done

info "Existing nginx sites (we will NOT modify these):"
ls -1 /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "^${NGINX_SITE}$" || echo "  (none)"
echo ""

# Generate nginx config from template
TEMPLATE="$INSTALL_DIR/deploy/hostinger/nginx-labmaster.conf.template"
if [ ! -f "$TEMPLATE" ]; then
    error "Template not found: $TEMPLATE"
fi

info "Creating NEW nginx site: $NGINX_AVAILABLE"
sed -e "s/__LABMASTER_DOMAIN__/${DOMAIN}/g" \
    -e "s/__LABMASTER_WEB_PORT__/${WEB_PORT}/g" \
    -e "s/__LABMASTER_API_PORT__/${API_PORT}/g" \
    "$TEMPLATE" > "$NGINX_AVAILABLE"

ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"

info "Testing nginx configuration..."
if ! nginx -t 2>&1; then
    error "Nginx config test failed. Removed broken config."
    rm -f "$NGINX_ENABLED" "$NGINX_AVAILABLE"
    exit 1
fi

info "Reloading nginx (existing sites unaffected)..."
systemctl reload nginx

# Update .env.production with domain
API_URL="https://${DOMAIN}/api/v1"
HTTP_API_URL="http://${DOMAIN}/api/v1"

info "Updating .env.production..."
if grep -q "^NEXT_PUBLIC_API_URL=" "$ENV_FILE"; then
    sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=${HTTP_API_URL}|" "$ENV_FILE"
else
    echo "NEXT_PUBLIC_API_URL=${HTTP_API_URL}" >> "$ENV_FILE"
fi

if grep -q "^CORS_ORIGINS=" "$ENV_FILE"; then
    sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=[\"http://${DOMAIN}\",\"https://${DOMAIN}\"]|" "$ENV_FILE"
else
    echo "CORS_ORIGINS=[\"http://${DOMAIN}\",\"https://${DOMAIN}\"]" >> "$ENV_FILE"
fi

if grep -q "^LABMASTER_DOMAIN=" "$ENV_FILE"; then
    sed -i "s|^LABMASTER_DOMAIN=.*|LABMASTER_DOMAIN=${DOMAIN}|" "$ENV_FILE"
else
    echo "LABMASTER_DOMAIN=${DOMAIN}" >> "$ENV_FILE"
fi

info "Rebuilding frontend with domain API URL..."
export NEXT_PUBLIC_API_URL="${HTTP_API_URL}"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build frontend

echo ""
echo "=============================================="
echo -e "${GREEN}Domain setup complete!${NC}"
echo "=============================================="
echo ""
echo "  HTTP:  http://${DOMAIN}"
echo "  API:   http://${DOMAIN}/api/v1"
echo "  Docs:  http://${DOMAIN}/docs"
echo ""
echo "DNS checklist (Cloudflare or Hostinger):"
echo "  Type: A  (NOT AAAA)"
echo "  Name: $(echo "$DOMAIN" | cut -d. -f1)"
echo "  Value: 187.124.15.14   (IPv4 — your VPS IP)"
echo "  Proxy: DNS only (grey cloud in Cloudflare)"
echo "  TTL: 300"
echo ""
echo "If wrong project shows (Fratelanza instead of LabMaster), run:"
echo "  sudo bash deploy/hostinger/fix-nginx-routing.sh $DOMAIN"
echo ""
echo "Next — enable HTTPS (only affects LabMaster site):"
echo "  sudo certbot --nginx -d ${DOMAIN}"
echo ""
echo "After SSL, update API URL to HTTPS and rebuild:"
echo "  cd $INSTALL_DIR"
echo "  sed -i 's|http://${DOMAIN}|https://${DOMAIN}|g' .env.production"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build frontend"
echo ""
echo "Or run: sudo bash deploy/hostinger/enable-ssl.sh ${DOMAIN}"
echo ""
echo "Demo login: admin@demo-lab.eg / Demo@123  (tenant: demo-lab)"
