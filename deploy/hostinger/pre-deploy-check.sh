#!/bin/bash
# LabMaster Egypt - Pre-deploy safety check
# Run BEFORE deploying to ensure we won't conflict with existing projects.

set -e

echo "=== LabMaster Pre-Deploy Safety Check ==="
echo ""

PORTS=(13000 18000 15432 16379)
CONFLICTS=0

echo "Checking ports (LabMaster uses these — change in .env.production if taken):"
for port in "${PORTS[@]}"; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} " || netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
        echo "  WARNING: Port $port is IN USE — change LABMASTER_*_PORT in .env.production"
        CONFLICTS=$((CONFLICTS + 1))
    else
        echo "  OK: Port $port is free"
    fi
done
echo ""

echo "Existing Docker containers (your other projects — we will NOT touch these):"
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" 2>/dev/null || echo "  Docker not running or not installed"
echo ""

echo "Existing LabMaster containers (if any):"
docker ps -a --filter "name=labmaster" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || true
echo ""

echo "Disk space:"
df -h / | tail -1
echo ""

if [ "$CONFLICTS" -gt 0 ]; then
    echo "FAILED: $CONFLICTS port conflict(s). Edit .env.production before deploying."
    exit 1
fi

echo "Safe to deploy LabMaster to /opt/labmaster"
echo "Your existing projects on ports 80/443/3000/8000/5432 are untouched."
