# Lumentra Production Deployment Guide

## Hetzner + Coolify Setup

**Total Cost: $14/month**

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Part 1: Create Hetzner Server](#part-1-create-hetzner-server)
4. [Part 2: Configure Coolify](#part-2-configure-coolify)
5. [Part 3: Database Strategy](#part-3-database-strategy)
6. [Part 4: Deploy Application](#part-4-deploy-application)
7. [Part 5: Domain and SSL](#part-5-domain-and-ssl)
8. [Part 6: Environment Variables](#part-6-environment-variables)
9. [Part 7: Update SignalWire Webhooks](#part-7-update-signalwire-webhooks)
10. [Part 8: Monitoring and Backups](#part-8-monitoring-and-backups)
11. [Part 9: Verification](#part-9-verification)
12. [Troubleshooting](#troubleshooting)

---

## Overview

### What We're Setting Up

```
Internet
    |
    v
Hetzner CCX13 Server ($14/mo)
    |
    +-- Coolify (manages deployments)
    |       |
    |       +-- Lumentra API (Node.js)
    |       +-- Auto SSL (Let's Encrypt)
    |       +-- Auto deployments (git push)
    |
    +-- Connects to --> Supabase (external database, free tier)
```

### Why This Setup

| Component | Choice | Reason |
|-----------|--------|--------|
| Server | Hetzner CCX13 | Dedicated CPU, best price ($14/mo) |
| Deployment | Coolify | Git push deploys, no manual SSH |
| Database | Supabase Free | Already integrated, no code changes |

### Time Estimate

| Step | Time |
|------|------|
| Create Hetzner server | 10 min |
| Configure Coolify | 15 min |
| Deploy application | 15 min |
| Configure domain/SSL | 10 min |
| Update SignalWire | 5 min |
| Testing | 15 min |
| **Total** | **~70 min** |

---

## Prerequisites

Before starting, ensure you have:

- [ ] Hetzner account (create at https://www.hetzner.com)
- [ ] GitHub account with Lumentra repo access
- [ ] Domain name (for SSL and webhooks)
- [ ] Current environment variables from your `.env` file
- [ ] SignalWire dashboard access

---

## Part 1: Create Hetzner Server

### Step 1.1: Log into Hetzner Cloud Console

1. Go to https://console.hetzner.cloud
2. Log in or create account
3. Create a new project (e.g., "Lumentra Production")

### Step 1.2: Create Server

1. Click **"Add Server"**

2. **Location:** Select based on your primary customers
   - `ash` (Ashburn, Virginia) - US East Coast
   - `hil` (Hillsboro, Oregon) - US West Coast

   > For hotels/clinics across US, choose **Ashburn (ash)** for better East Coast coverage

3. **Image:** Click **"Apps"** tab, select **"Coolify"**

4. **Type:** Select **"Dedicated"** tab, then **"CCX13"**
   - 2 Dedicated vCPU
   - 8 GB RAM
   - 80 GB SSD
   - $14.09/month

5. **Networking:**
   - Enable **IPv4** (required)
   - Enable **IPv6** (optional)

6. **SSH Key:**
   - Click "Add SSH Key"
   - Paste your public key (`cat ~/.ssh/id_rsa.pub`)
   - Or create new: `ssh-keygen -t rsa -b 4096`

7. **Name:** Enter `lumentra-prod`

8. Click **"Create & Buy Now"**

### Step 1.3: Note Your Server IP

Once created, note the **IPv4 address** (e.g., `123.45.67.89`)

You'll need this for:
- DNS configuration
- SSH access
- Coolify dashboard

---

## Part 2: Configure Coolify

### Step 2.1: Activate Coolify

SSH into your server to activate Coolify:

```bash
ssh root@YOUR_SERVER_IP
```

You'll see a welcome message with Coolify activation. Follow the prompts.

After activation, you'll see:
```
Coolify is ready!
Dashboard: http://YOUR_SERVER_IP:8000
```

### Step 2.2: Access Coolify Dashboard

1. Open browser: `http://YOUR_SERVER_IP:8000`
2. Create admin account:
   - Email: your email
   - Password: strong password
3. Click "Register"

### Step 2.3: Initial Coolify Setup

1. **Server Configuration:**
   - Coolify auto-detects the local server
   - Click "Validate Server" to confirm

2. **Connect GitHub:**
   - Go to **Settings** > **Sources**
   - Click **"Add Source"** > **"GitHub"**
   - Choose "GitHub App" (recommended)
   - Follow OAuth flow to authorize
   - Select your repository

---

## Part 3: Database Strategy

### Important Note

Your application uses the **Supabase SDK** (`@supabase/supabase-js`), not direct PostgreSQL connections. This means:

- Switching to self-hosted PostgreSQL requires code refactoring
- For the fastest deployment, keep using Supabase
- We'll add a keep-alive to prevent free tier pausing

### Option A: Keep Supabase Free Tier (Recommended for Launch)

**Cost:** $0/month

**Setup:** Add a keep-alive endpoint that Coolify will ping daily.

The keep-alive prevents the 7-day inactivity pause. Since your voice app will have regular calls, it likely won't pause anyway, but this is extra insurance.

### Option B: Upgrade to Supabase Pro Later

If you outgrow free tier or want guaranteed uptime:
- Upgrade to Pro ($25/mo) via Supabase dashboard
- No code or configuration changes needed

### Database Keep-Alive Setup

We'll configure Coolify to ping your health endpoint daily, which queries the database and prevents pausing.

---

## Part 4: Deploy Application

### Step 4.1: Create New Project in Coolify

1. In Coolify dashboard, click **"Projects"**
2. Click **"Add Project"**
3. Name: `lumentra`
4. Click **"Create"**

### Step 4.2: Add Application

1. Inside the project, click **"Add Resource"**
2. Select **"Application"**
3. Choose **"GitHub"** as source

### Step 4.3: Configure Application

1. **Repository:** Select `callagent` (or your repo name)
2. **Branch:** `main`
3. **Build Pack:** Select **"Dockerfile"**
4. **Dockerfile Path:** `lumentra-api/Dockerfile`
5. **Base Directory:** `lumentra-api`

### Step 4.4: Configure Build Settings

Click on the application, then **"Build"** settings:

```
Build Command: (leave empty - Dockerfile handles it)
Start Command: (leave empty - Dockerfile handles it)
```

### Step 4.5: Configure Port

In **"Network"** settings:

```
Port: 3100
```

### Step 4.6: Configure Health Check

In **"Health Check"** settings:

```
Health Check Path: /health/ping
Health Check Interval: 30
```

---

## Part 5: Domain and SSL

### Step 5.1: Configure DNS

In your domain registrar (Namecheap, Cloudflare, etc.):

1. Add an **A Record**:
   ```
   Type: A
   Name: api (or @ for root)
   Value: YOUR_SERVER_IP
   TTL: 300
   ```

2. Example:
   ```
   api.lumentra.com -> 123.45.67.89
   ```

### Step 5.2: Configure Domain in Coolify

1. In your application settings, go to **"Domains"**
2. Add your domain: `api.yourdomain.com`
3. Enable **"Generate SSL"** (uses Let's Encrypt)
4. Click **"Save"**

Coolify will automatically:
- Configure reverse proxy
- Generate SSL certificate
- Auto-renew certificate

### Step 5.3: Verify SSL

Wait 2-3 minutes, then check:
```
https://api.yourdomain.com/health/ping
```

Should return: `pong`

---

## Part 6: Environment Variables

### Step 6.1: Add Environment Variables in Coolify

1. In your application, go to **"Environment Variables"**
2. Click **"Add"** for each variable

### Required Variables

Add these from your current `.env` file:

**Database (Supabase):**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**LLM (Gemini - Primary):**
```
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.5-flash
```

**LLM (OpenAI - Fallback):**
```
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini
```

**LLM (Groq - Fallback):**
```
GROQ_API_KEY=your-groq-key
GROQ_CHAT_MODEL=llama-3.1-8b-instant
GROQ_TOOL_MODEL=llama-3.3-70b-versatile
```

**Voice Stack:**
```
SIGNALWIRE_PROJECT_ID=your-project-id
SIGNALWIRE_API_TOKEN=your-api-token
SIGNALWIRE_SPACE_URL=yourspace.signalwire.com
SIGNALWIRE_PHONE_NUMBER=+1xxxxxxxxxx
DEEPGRAM_API_KEY=your-deepgram-key
CARTESIA_API_KEY=your-cartesia-key
```

**Server:**
```
NODE_ENV=production
PORT=3100
BACKEND_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

**SMS (Twilio):**
```
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

### Step 6.2: Save and Deploy

1. Click **"Save"**
2. Click **"Deploy"** to apply changes

---

## Part 7: Update SignalWire Webhooks

### Step 7.1: Log into SignalWire Dashboard

1. Go to https://signalwire.com
2. Navigate to your project
3. Go to **Phone Numbers**

### Step 7.2: Update Voice Webhook

For your phone number, update:

**Voice URL (POST):**
```
https://api.yourdomain.com/signalwire/voice
```

### Step 7.3: Update Media Stream (if configured separately)

**WebSocket URL:**
```
wss://api.yourdomain.com/signalwire/stream
```

### Step 7.4: Save Changes

Click **"Save"** in SignalWire dashboard.

---

## Part 8: Monitoring and Backups

### Step 8.1: Set Up UptimeRobot (Free)

1. Go to https://uptimerobot.com
2. Create free account
3. Click **"Add New Monitor"**
4. Configure:
   ```
   Monitor Type: HTTP(s)
   Friendly Name: Lumentra API
   URL: https://api.yourdomain.com/health/ping
   Monitoring Interval: 5 minutes
   ```
5. Add alert contacts (email, SMS)

### Step 8.2: Database Keep-Alive

UptimeRobot pinging `/health/ping` will also query the database, preventing Supabase free tier from pausing.

### Step 8.3: Coolify Backups (Optional)

In Coolify:
1. Go to **Settings** > **Backup**
2. Configure backup schedule
3. Optionally add S3 for offsite backups

---

## Part 9: Verification

### Step 9.1: Test Health Endpoint

```bash
curl https://api.yourdomain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "database": { "connected": true },
    "llm": { "configured": true }
  }
}
```

### Step 9.2: Test Voice Call

1. Call your SignalWire phone number
2. Verify:
   - Greeting plays correctly
   - Speech recognition works
   - AI responds appropriately
   - Call logs appear in database

### Step 9.3: Test Auto-Deployment

1. Make a small change to your code
2. Push to `main` branch:
   ```bash
   git add .
   git commit -m "Test deployment"
   git push origin main
   ```
3. Watch Coolify dashboard - deployment should start automatically
4. Verify changes are live after deployment completes

---

## Troubleshooting

### Application Won't Start

**Check logs in Coolify:**
1. Go to application > **"Logs"**
2. Look for error messages

**Common issues:**
- Missing environment variables
- Port mismatch (should be 3100)
- Dockerfile path incorrect

### SSL Certificate Failed

**Check:**
1. DNS is properly configured (A record points to server IP)
2. Wait 5-10 minutes for DNS propagation
3. In Coolify, click "Regenerate SSL"

### Database Connection Failed

**Check:**
1. `SUPABASE_URL` and keys are correct
2. Supabase project is not paused
3. Test connection: visit `/health` endpoint

### Voice Calls Not Working

**Check:**
1. SignalWire webhooks point to correct URL
2. SSL is working (webhooks require HTTPS)
3. Check application logs for errors
4. Verify Deepgram and Cartesia API keys

### Deployment Stuck

**Try:**
1. Cancel current deployment
2. Clear build cache in Coolify
3. Redeploy

---

## Quick Reference

### Server Access

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# View Coolify logs
docker logs coolify -f
```

### URLs

| Service | URL |
|---------|-----|
| Coolify Dashboard | `http://YOUR_SERVER_IP:8000` |
| API (after SSL) | `https://api.yourdomain.com` |
| Health Check | `https://api.yourdomain.com/health` |

### Costs Summary

| Component | Monthly Cost |
|-----------|--------------|
| Hetzner CCX13 | $14.09 |
| Supabase Free | $0 |
| UptimeRobot | $0 |
| SSL (Let's Encrypt) | $0 |
| **Total** | **$14.09/month** |

---

## Next Steps After Deployment

1. **Monitor for 24-48 hours** - Watch logs and uptime
2. **Test with real calls** - Have team members make test calls
3. **Set up error alerting** - Consider Sentry free tier for error tracking
4. **Document for team** - Share access credentials securely

---

*Guide created: January 29, 2026*
*For: Lumentra Voice AI Platform*
