# LabMaster Isolation Guarantee

**LabMaster does NOT modify your other projects.** Here is exactly what each script touches:

## What LabMaster creates (only these)

| Path | Purpose |
|------|---------|
| `/opt/labmaster/` | LabMaster code only |
| `/etc/nginx/sites-available/labmaster` | NEW file — LabMaster subdomain only |
| `/etc/nginx/sites-enabled/00-labmaster` | Symlink to above (00- prefix loads early) |
| Docker containers named `labmaster-*` | Isolated containers |
| Docker network `labmaster_net` | Isolated network |
| Docker volume `labmaster_postgres_data` | Isolated database |
| Ports `13000`, `18000`, `15432`, `16379` | Internal — not 80/443 |

## What LabMaster NEVER touches

| Path | Your projects |
|------|---------------|
| `/etc/nginx/sites-enabled/default` | ❌ Not edited |
| `/etc/nginx/sites-enabled/fratelanza*` | ❌ Not edited |
| Any file in `/var/www/` except `/var/www/certbot` | ❌ Not edited |
| Ports `80`, `443`, `3000`, `8000`, `5432` | ❌ Not used by LabMaster |
| Other Docker containers | ❌ Not stopped/modified |

## Verify on your VPS

```bash
# List ONLY labmaster nginx file (should not list fratelanza)
ls -la /etc/nginx/sites-available/labmaster

# Confirm Fratelanza config unchanged (check modification time before/after)
ls -la /etc/nginx/sites-enabled/

# LabMaster containers only
docker ps --filter "name=labmaster"

# Other projects still running
docker ps
```

## If labmaster shows Fratelanza

This is **nginx routing**, not LabMaster editing Fratelanza.  
Fratelanza's wildcard `*.fratelanza.com` catches the subdomain.  
Fix: `sudo bash /opt/labmaster/deploy/hostinger/apply-labmaster-nginx.sh labmaster.fratelanza.com`

Or full repair: `sudo bash /opt/labmaster/deploy/hostinger/fix-nginx-routing.sh labmaster.fratelanza.com`

**Never run `certbot --nginx`** on a shared VPS — it may edit Fratelanza's config.  
Use `enable-ssl.sh` (certbot certonly + apply-labmaster-nginx.sh) instead.

Reference config (saved): `deploy/hostinger/nginx-labmaster.conf.reference`
