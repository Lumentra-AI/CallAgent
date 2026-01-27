# Lumentra Production Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- Domain name with DNS configured
- SSL certificates (Let's Encrypt recommended)
- Supabase project created
- API keys for: Groq, Deepgram, Cartesia, SignalWire

## Quick Start (Docker)

### 1. Clone and Configure

```bash
git clone <repo-url>
cd callagent

# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env
```

### 2. Required Environment Variables

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Voice Services
GROQ_API_KEY=your-groq-key
DEEPGRAM_API_KEY=your-deepgram-key
CARTESIA_API_KEY=your-cartesia-key
SIGNALWIRE_PROJECT_ID=your-project-id
SIGNALWIRE_API_TOKEN=your-api-token
SIGNALWIRE_SPACE_URL=your-space.signalwire.com

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_TENANT_ID=your-tenant-uuid
```

### 3. Deploy with Docker Compose

```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Check health
curl http://localhost:3100/health
```

### 4. Access the Application

- Dashboard: http://localhost:3000
- API: http://localhost:3100

---

## Production Setup with Nginx

### 1. Enable Nginx Profile

```bash
docker-compose --profile production up -d
```

### 2. Configure SSL (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d api.yourdomain.com -d app.yourdomain.com

# Copy certs to project
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./certs/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./certs/
```

### 3. Update nginx.conf for SSL

Uncomment the HTTPS server block in `nginx.conf` and update the domain.

---

## Database Setup

### 1. Run Migrations

Execute the SQL files in order in your Supabase SQL editor:

```
migrations/001_initial_schema.sql
migrations/002_crm_tables.sql
migrations/003_seed_test_data.sql  (optional)
migrations/005_voicemails.sql
```

### 2. Create Your Tenant

```bash
curl -X POST http://localhost:3100/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Business",
    "industry": "hotel",
    "phone": "+15551234567",
    "email": "admin@yourbusiness.com"
  }'
```

Save the returned `id` as your `NEXT_PUBLIC_TENANT_ID`.

---

## SignalWire Configuration

### 1. Create a Phone Number

1. Log in to SignalWire dashboard
2. Go to Phone Numbers > Buy a Number
3. Select your preferred area code

### 2. Configure Webhook

Set the voice webhook URL to:

```
https://api.yourdomain.com/signalwire/voice
```

Method: POST

### 3. Configure Media Streams (for custom voice stack)

Set the status callback URL to:

```
wss://api.yourdomain.com/signalwire/stream
```

---

## Scaling Considerations

### Horizontal Scaling

```yaml
# docker-compose.override.yml
services:
  api:
    deploy:
      replicas: 3
```

### Load Balancer

For multiple API instances, use nginx or a cloud load balancer.

### Database Connection Pooling

For high traffic, enable PgBouncer in Supabase:

1. Go to Project Settings > Database
2. Enable connection pooling
3. Use the pooler connection string

---

## Monitoring

### Health Checks

```bash
# API health
curl https://api.yourdomain.com/health

# Docker health
docker-compose ps
```

### Logs

```bash
# All logs
docker-compose logs -f

# API only
docker-compose logs -f api

# Dashboard only
docker-compose logs -f dashboard
```

### Metrics Endpoint

```bash
curl https://api.yourdomain.com/api/dashboard/metrics
```

---

## Backup and Recovery

### Database Backup

Supabase provides automatic backups. For manual backup:

```sql
-- In Supabase SQL editor
COPY (SELECT * FROM tenants) TO '/tmp/tenants_backup.csv' CSV HEADER;
COPY (SELECT * FROM calls) TO '/tmp/calls_backup.csv' CSV HEADER;
COPY (SELECT * FROM bookings) TO '/tmp/bookings_backup.csv' CSV HEADER;
COPY (SELECT * FROM contacts) TO '/tmp/contacts_backup.csv' CSV HEADER;
```

### Docker Volumes

```bash
# Backup volumes
docker run --rm -v lumentra_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/lumentra-backup.tar.gz /data
```

---

## Troubleshooting

### Common Issues

**API not starting:**

```bash
docker-compose logs api
# Check for missing env vars or connection errors
```

**Voice calls not working:**

1. Verify SignalWire credentials
2. Check webhook URL is accessible
3. Verify ngrok/tunnel is running (for local dev)

**Frontend can't connect to API:**

1. Check CORS settings
2. Verify NEXT_PUBLIC_API_URL is correct
3. Check network/firewall rules

### Debug Mode

```bash
# Start with debug logs
DEBUG=* docker-compose up
```

---

## Security Checklist

- [ ] SSL/TLS enabled for all endpoints
- [ ] Environment variables not committed to git
- [ ] Supabase RLS policies enabled
- [ ] API rate limiting configured (nginx)
- [ ] Regular backups scheduled
- [ ] Webhook URLs use HTTPS
- [ ] Admin credentials rotated from defaults

---

## Cost Estimates (Monthly)

| Service       | Free Tier               | Production Est. |
| ------------- | ----------------------- | --------------- |
| Supabase      | 500MB DB, 2GB bandwidth | $25-50          |
| Groq          | 1M tokens               | $20-50          |
| Deepgram      | 200 mins                | $20-50          |
| Cartesia      | -                       | $50-100         |
| SignalWire    | Free trial              | $10-50          |
| Cloud Hosting | -                       | $20-100         |
| **Total**     | ~$0 (limited)           | **$145-400**    |

---

## Support

- Issues: https://github.com/your-repo/issues
- Documentation: See BUILD_PLAN.md for full feature list
