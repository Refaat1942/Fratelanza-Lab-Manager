# Deploy LabMaster Egypt on Hostinger VPS (Safe Mode)

This guide deploys LabMaster **without affecting your existing projects**.

## Safety Guarantees

| What LabMaster uses | What it does NOT touch |
|---------------------|------------------------|
| Ports `13000`, `18000`, `15432`, `16379` | Ports `80`, `443`, `3000`, `8000`, `5432` |
| Directory `/opt/labmaster` | Your other project folders |
| Docker project name `labmaster` | Other Docker containers |
| Nginx site `labmaster.conf` (new file) | Existing nginx site configs |
| Volume `labmaster_postgres_data` | Other database volumes |

## Your VPS Details

From your Hostinger panel:
- **IP:** `187.124.15.14`
- **OS:** Ubuntu 24.04 LTS
- **SSH:** `ssh root@187.124.15.14`

## Step 1: SSH into VPS

```bash
ssh root@187.124.15.14
```

## Step 2: Check existing projects (optional)

```bash
docker ps
ss -tlnp | grep LISTEN
ls /etc/nginx/sites-enabled/
```

Note what's already running so you know LabMaster won't conflict.

## Step 3: One-command deploy

```bash
curl -fsSL https://raw.githubusercontent.com/Refaat1942/Fratelanza-Lab-Manager/main/deploy/hostinger/deploy.sh | bash
```

Or manually:

```bash
git clone https://github.com/Refaat1942/Fratelanza-Lab-Manager.git /opt/labmaster
cd /opt/labmaster
bash deploy/hostinger/pre-deploy-check.sh
cp .env.production.example .env.production
# Edit .env.production — set your domain in NEXT_PUBLIC_API_URL and CORS_ORIGINS
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Step 4: Verify

```bash
curl http://127.0.0.1:18000/health
curl -I http://127.0.0.1:13000
docker compose -f docker-compose.prod.yml ps
```

Open in browser: `http://187.124.15.14:13000`

## Step 5: Add subdomain (recommended)

1. In Hostinger DNS, add an **A record**: `lab` → `187.124.15.14`
2. Copy nginx config:
   ```bash
   sudo cp /opt/labmaster/deploy/hostinger/nginx-labmaster.conf /etc/nginx/sites-available/labmaster
   sudo nano /etc/nginx/sites-available/labmaster
   # Change lab.yourdomain.com to your real subdomain
   sudo ln -sf /etc/nginx/sites-available/labmaster /etc/nginx/sites-enabled/labmaster
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. SSL with Let's Encrypt:
   ```bash
   sudo certbot --nginx -d lab.yourdomain.com
   ```
4. Update `.env.production`:
   ```
   NEXT_PUBLIC_API_URL=https://lab.yourdomain.com/api/v1
   CORS_ORIGINS=["https://lab.yourdomain.com"]
   ```
5. Rebuild frontend:
   ```bash
   cd /opt/labmaster
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build frontend
   ```

## Production Admin Credentials

Do not use demo/default passwords in production. To create the first platform
administrator on a fresh production database, set `PLATFORM_ADMIN_USERNAME` and
a strong `PLATFORM_ADMIN_PASSWORD` in `.env.production` before starting the
backend. Existing admin passwords are never reset automatically.

## Update / Redeploy

```bash
cd /opt/labmaster
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Stop LabMaster (without touching other projects)

```bash
cd /opt/labmaster
docker compose -f docker-compose.prod.yml down
```

## Port conflicts?

If ports 13000/18000 are taken, edit `.env.production`:

```
LABMASTER_WEB_PORT=13001
LABMASTER_API_PORT=18001
```

Then redeploy.
