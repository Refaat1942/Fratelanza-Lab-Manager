# Connect LabMaster to Your Domain (Without Touching Other Projects)

## The Safe Approach: Use a Subdomain

If you already have websites on your VPS, **do not use your root domain** (`yourdomain.com`).  
Use a **subdomain** dedicated to LabMaster:

| Good (safe) | Avoid if root domain is in use |
|-------------|-------------------------------|
| `labmaster.yourdomain.com` | `yourdomain.com` |
| `lab.yourdomain.com` | `www.yourdomain.com` |
| `lims.yourdomain.com` | |

LabMaster gets its **own nginx config file** (`/etc/nginx/sites-available/labmaster`).  
Your existing sites in `sites-enabled/` are **never edited**.

## How It Works

```
yourdomain.com          → your existing project (unchanged)
www.yourdomain.com      → your existing project (unchanged)
labmaster.yourdomain.com → LabMaster (new nginx site only)
```

Nginx routes by `server_name` — each domain/subdomain goes to a different backend.

---

## Step-by-Step

### 1. Deploy LabMaster (if not done)

```bash
ssh root@187.124.15.14
curl -fsSL https://raw.githubusercontent.com/Refaat1942/Fratelanza-Lab-Manager/main/deploy/hostinger/deploy.sh | bash
```

### 2. Add DNS in Hostinger hPanel

Go to **Domains → yourdomain.com → DNS / Nameservers → DNS records**

Add a new **A record**:

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| A | `labmaster` | `187.124.15.14` | 300 |

This creates `labmaster.yourdomain.com` → your VPS.

Wait 5–15 minutes for DNS propagation. Test:

```bash
ping labmaster.yourdomain.com
```

### 3. Connect domain (one command)

```bash
cd /opt/labmaster
sudo bash deploy/hostinger/setup-domain.sh labmaster.yourdomain.com
```

This script:
- Creates **only** `/etc/nginx/sites-available/labmaster`
- Symlinks it to `sites-enabled/labmaster`
- Runs `nginx -t` before reload
- Checks the domain isn't already used by another site
- Updates `.env.production` and rebuilds frontend

Your other nginx configs are **not modified**.

### 4. Enable HTTPS

```bash
sudo bash deploy/hostinger/enable-ssl.sh labmaster.yourdomain.com
```

Certbot adds SSL **only** to the LabMaster nginx site.

### 5. Open in browser

- **App:** https://labmaster.yourdomain.com
- **API:** https://labmaster.yourdomain.com/api/v1
- **Docs:** https://labmaster.yourdomain.com/docs

**Login:** `admin@demo-lab.eg` / `Demo@123` (tenant: `demo-lab`)

---

## Verify Nothing Else Broke

```bash
# List all nginx sites
ls -la /etc/nginx/sites-enabled/

# Test all configs
sudo nginx -t

# Check your existing sites still work
curl -I https://yourdomain.com
curl -I https://labmaster.yourdomain.com
```

---

## Troubleshooting

### "Domain already configured in another site"
Pick a different subdomain, e.g. `lab.yourdomain.com` or `lims.yourdomain.com`.

### DNS not resolving
- Confirm A record in Hostinger DNS
- Wait up to 30 minutes
- Use `dig labmaster.yourdomain.com` to check

### 502 Bad Gateway
LabMaster containers may be down:
```bash
cd /opt/labmaster
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Login works on IP but not domain
Rebuild frontend after domain setup:
```bash
cd /opt/labmaster
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build frontend
```

### Remove LabMaster domain (keep other projects)
```bash
sudo rm /etc/nginx/sites-enabled/labmaster
sudo nginx -t && sudo systemctl reload nginx
# Other sites continue working
```
