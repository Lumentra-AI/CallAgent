# Phase 1: Infrastructure Deployment Guide

## Pre-Deployment Checklist

### 1. Coolify Critical Settings

**BEFORE deploying anything:**

1. Go to Coolify > Server Settings > Docker Cleanup
2. **DISABLE "Delete Unused Volumes"** - This prevents data loss on container restarts
3. Save settings

### 2. Hetzner Volume Setup

SSH into your server:

```bash
ssh root@178.156.205.145
```

Check if volume is already attached:

```bash
lsblk
```

If you see a volume (e.g., `/dev/sdb`), mount it:

```bash
# Format if new (CAUTION: destroys data)
mkfs.ext4 /dev/sdb

# Create mount point
mkdir -p /mnt/data

# Mount volume
mount /dev/sdb /mnt/data

# Add to fstab for persistence
echo '/dev/sdb /mnt/data ext4 defaults 0 2' >> /etc/fstab

# Create directory structure
mkdir -p /mnt/data/{postgresql,minio,backups}

# Set permissions
chown -R 999:999 /mnt/data/postgresql  # PostgreSQL user
chown -R 1000:1000 /mnt/data/minio     # MinIO user

# Verify
ls -la /mnt/data/
```

### 3. Generate Secrets

```bash
# Generate Authentik secret key
openssl rand -hex 32
# Example output: a1b2c3d4e5f6...

# Generate PostgreSQL password
openssl rand -base64 32
# Example output: XyZ123...

# Generate MinIO password
openssl rand -base64 16
# Example output: AbC456...
```

### 4. DNS Configuration (Cloudflare)

Add these DNS records pointing to your Hetzner IP (178.156.205.145):

| Type | Name    | Content         | Proxy                 |
| ---- | ------- | --------------- | --------------------- |
| A    | auth    | 178.156.205.145 | DNS only (grey cloud) |
| A    | storage | 178.156.205.145 | DNS only (grey cloud) |
| A    | s3      | 178.156.205.145 | DNS only (grey cloud) |

**Important:** Keep proxy OFF (DNS only) until SSL certificates are issued.

## Deployment via Coolify

### Option A: Deploy as Docker Compose (Recommended)

1. In Coolify, go to **Projects** > Create new project
2. Name it: `lumentra-infrastructure`
3. Add new resource > **Docker Compose**
4. Paste contents of `docker-compose.infrastructure.yml`
5. Go to **Environment Variables** tab
6. Add all variables from `.env.example` with real values
7. Go to **Domains** tab and configure:
   - `auth.lumentra.ai` -> container `lumentra-authentik-server` port `9000`
   - `storage.lumentra.ai` -> container `lumentra-minio` port `9001`
   - `s3.lumentra.ai` -> container `lumentra-minio` port `9000`
8. Enable **Let's Encrypt** for all domains
9. Click **Deploy**

### Option B: Deploy Services Individually

If you prefer one-click services:

#### PostgreSQL

1. Add resource > **PostgreSQL**
2. Configure:
   - Version: 16
   - Database name: lumentra
   - Username: lumentra
   - Persistent storage: `/mnt/data/postgresql`
3. Deploy

#### Authentik

1. Add resource > **Authentik** (if available) OR Docker Compose
2. **Important:** Manually add port 9000 to exposed ports (template bug)
3. Configure environment variables
4. Deploy

#### MinIO

1. Add resource > **MinIO**
2. Configure:
   - Persistent storage: `/mnt/data/minio`
   - Expose both ports 9000 (API) and 9001 (Console)
3. Deploy

## Post-Deployment Verification

### 1. Check Services Running

```bash
ssh root@178.156.205.145
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:

```
NAMES                      STATUS          PORTS
lumentra-postgres          Up (healthy)    127.0.0.1:5432->5432/tcp
lumentra-authentik-server  Up (healthy)    0.0.0.0:9000->9000/tcp
lumentra-authentik-worker  Up
lumentra-minio             Up (healthy)    0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp
```

### 2. Test PostgreSQL

```bash
docker exec -it lumentra-postgres psql -U lumentra -d lumentra -c "SELECT version();"
docker exec -it lumentra-postgres psql -U lumentra -d lumentra -c "\l"
```

### 3. Test Authentik

Visit: https://auth.lumentra.ai/if/flow/initial-setup/

Complete initial admin setup:

1. Create admin account
2. Set admin password
3. Note the recovery codes

### 4. Test MinIO

Visit: https://storage.lumentra.ai

Login with MINIO_ROOT_USER and MINIO_ROOT_PASSWORD.

Verify buckets exist:

- voicemails
- attachments
- exports
- temp

## Troubleshooting

### Authentik Won't Start

**Symptom:** Container keeps restarting

**Check logs:**

```bash
docker logs lumentra-authentik-server --tail 100
```

**Common fixes:**

- Verify AUTHENTIK_SECRET_KEY is set (64+ chars)
- Verify PostgreSQL is healthy
- Verify authentik database was created

### MinIO Login Fails

**Symptom:** "Invalid credentials" after SSL setup

**Fixes:**

1. Check MINIO_BROWSER_REDIRECT_URL matches your domain
2. Verify both ports 9000 and 9001 are accessible
3. Check UFW/firewall rules

```bash
ufw status
ufw allow 9000/tcp
ufw allow 9001/tcp
```

### SSL Certificate Not Issuing

**Symptoms:** Browser shows insecure connection

**Fixes:**

1. Ensure DNS is "DNS only" in Cloudflare (not proxied)
2. Check Coolify proxy logs:

```bash
docker logs coolify-proxy --tail 100
```

3. Verify ports 80 and 443 are open:

```bash
ufw allow 80/tcp
ufw allow 443/tcp
```

### Volume Data Loss

**Symptom:** Data disappears after restart

**Verify:**

```bash
docker volume ls | grep lumentra
ls -la /mnt/data/postgresql/
ls -la /mnt/data/minio/
```

**Fix:** Ensure "Delete Unused Volumes" is OFF in Coolify settings.

## Resource Usage Expectations

After deployment, expected RAM usage:

| Service          | Expected RAM   |
| ---------------- | -------------- |
| PostgreSQL       | 500-800MB      |
| Authentik Server | 400-600MB      |
| Authentik Worker | 300-500MB      |
| MinIO            | 200-400MB      |
| **Total**        | **~1.5-2.3GB** |

Monitor with:

```bash
docker stats --no-stream
```

## Next Steps

After Phase 1 is complete:

1. **Phase 2:** Migrate data from Supabase to new PostgreSQL
2. **Phase 3:** Configure Authentik OAuth2 application

These can run in parallel since:

- Phase 2 only needs PostgreSQL
- Phase 3 only needs Authentik
