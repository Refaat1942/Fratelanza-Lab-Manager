#!/bin/bash
# Quick diagnostic — run on VPS to see why wrong project shows
DOMAIN="${1:-labmaster.fratelanza.com}"

echo "=== Routing Diagnostic for $DOMAIN ==="
echo ""

echo "1. LabMaster containers:"
docker ps --filter "name=labmaster" --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" 2>/dev/null || echo "  (docker not available)"
echo ""

echo "2. LabMaster direct ports:"
curl -s -o /dev/null -w "  Port 13000 (frontend): HTTP %{http_code}\n" http://127.0.0.1:13000/ 2>/dev/null || echo "  Port 13000: NOT REACHABLE"
curl -s -o /dev/null -w "  Port 18000 (API):      HTTP %{http_code}\n" http://127.0.0.1:18000/health 2>/dev/null || echo "  Port 18000: NOT REACHABLE"
echo ""

echo "3. What nginx serves for $DOMAIN (HTTP):"
BODY=$(curl -s -H "Host: $DOMAIN" http://127.0.0.1/ 2>/dev/null | head -c 150)
echo "  Body preview: $BODY"
if echo "$BODY" | grep -qi "fratelanza\|Fratelanza"; then
    echo "  >>> PROBLEM: Routing to Fratelanza, not LabMaster!"
elif echo "$BODY" | grep -qi "LabMaster\|Laboratory"; then
    echo "  >>> OK: Routing to LabMaster"
fi
echo ""

echo "4. What nginx serves for $DOMAIN (HTTPS):"
BODY_SSL=$(curl -sk -H "Host: $DOMAIN" https://127.0.0.1/ 2>/dev/null | head -c 150)
echo "  Body preview: $BODY_SSL"
if echo "$BODY_SSL" | grep -qi "fratelanza\|Fratelanza"; then
    echo "  >>> PROBLEM: HTTPS routes to Fratelanza (no SSL block for labmaster)"
fi
echo ""

echo "5. Nginx sites enabled:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null
echo ""

echo "6. LabMaster nginx config exists?"
[ -f /etc/nginx/sites-available/labmaster ] && echo "  YES: /etc/nginx/sites-available/labmaster" || echo "  NO — run fix-nginx-routing.sh"
echo ""

echo "7. Wildcard configs (these steal subdomains):"
grep -rlE 'server_name.*\*|default_server' /etc/nginx/sites-enabled/ 2>/dev/null | while read -r f; do
    echo "  $(basename "$f"):"
    grep -E 'server_name|default_server' "$f" | sed 's/^/    /'
done
echo ""

echo "8. DNS for $DOMAIN:"
dig +short "$DOMAIN" A 2>/dev/null || nslookup "$DOMAIN" 2>/dev/null | tail -3
echo "  (Should be 187.124.15.14 — IPv4 A record, NOT IPv6)"
echo ""
echo "FIX: sudo bash /opt/labmaster/deploy/hostinger/fix-nginx-routing.sh $DOMAIN"
