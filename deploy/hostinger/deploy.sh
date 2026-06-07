#!/bin/bash
# LabMaster Egypt - Safe Hostinger VPS deployment
# Installs to /opt/labmaster without touching other projects.

set -e

INSTALL_DIR="/opt/labmaster"
REPO_URL="${LABMASTER_REPO:-https://github.com/Refaat1942/Fratelanza-Lab-Manager.git}"
BRANCH="${LABMASTER_BRANCH:-main}"

echo "=== LabMaster Egypt Deployment ==="
echo "Install directory: $INSTALL_DIR"
echo "This will NOT modify your existing nginx sites or other Docker projects."
echo ""

# Run safety check
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/pre-deploy-check.sh" ]; then
    bash "$SCRIPT_DIR/pre-deploy-check.sh" || {
        echo "Fix port conflicts in .env.production and retry."
        exit 1
    }
fi

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    echo "Cloning repository..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Environment file
if [ ! -f .env.production ]; then
    echo ""
    echo "Creating .env.production from template..."
    cp .env.production.example .env.production
    SECRET=$(openssl rand -hex 32)
    DB_PASS=$(openssl rand -hex 16)
    sed -i "s/CHANGE_ME_OPENSSL_RAND_HEX_32/$SECRET/" .env.production
    sed -i "s/CHANGE_ME_STRONG_PASSWORD/$DB_PASS/" .env.production
    echo "Generated SECRET_KEY and POSTGRES_PASSWORD in .env.production"
    echo "⚠️  Edit NEXT_PUBLIC_API_URL and CORS_ORIGINS with your domain before going live."
fi

# Build and start (isolated project name)
echo ""
echo "Building and starting LabMaster containers..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo ""
echo "=== Deployment Complete ==="
echo ""
docker compose -f docker-compose.prod.yml ps
echo ""
echo "Access (direct ports):"
echo "  Frontend: http://$(hostname -I | awk '{print $1}'):13000"
echo "  API:      http://$(hostname -I | awk '{print $1}'):18000"
echo "  API Docs: http://$(hostname -I | awk '{print $1}'):18000/docs"
echo ""
echo "Next — connect your domain (safe, won't touch existing projects):"
echo "  1. Hostinger DNS: A record  labmaster  →  $(hostname -I | awk '{print $1}')"
echo "  2. sudo bash deploy/hostinger/setup-domain.sh labmaster.yourdomain.com"
echo "  3. sudo bash deploy/hostinger/enable-ssl.sh labmaster.yourdomain.com"
echo ""
echo "  Full guide: docs/DOMAIN_SETUP.md"
echo ""
echo "Demo login: admin@demo-lab.eg / Demo@123 (tenant: demo-lab)"
