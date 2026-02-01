# Lumentra Voice AI - Hosting Report

**Date:** January 29, 2026
**Purpose:** Evaluate hosting options for production B2B voice AI platform
**Target Clients:** Hotels, motels, clinics, doctor's offices

---

## Executive Summary

For B2B voice AI serving professional clients, **dedicated CPU is required** to ensure consistent call quality. Shared CPU hosting risks audio stuttering and dropped calls when server resources are contested.

**Recommendation:** Hetzner CCX13 ($14/mo) for launch, Google Cloud Run for scale.

---

## Requirements

| Requirement | Why |
|-------------|-----|
| Dedicated CPU | Voice calls need consistent low-latency processing |
| WebSocket support | Real-time audio streaming |
| 99.9%+ uptime | B2B clients expect reliability |
| Scalability | Unknown client growth |

---

## Hosting Comparison

| Provider | Plan | Price | CPU | RAM | Dedicated | Verdict |
|----------|------|-------|-----|-----|-----------|---------|
| Hostinger | KVM 4 | $13/mo | 4 vCPU | 16GB | No | Not suitable |
| Hetzner | CCX13 | $14/mo | 2 vCPU | 8GB | **Yes** | **Best value** |
| Hetzner | CCX23 | $27/mo | 4 vCPU | 16GB | **Yes** | Growth option |
| DigitalOcean | Premium | $21/mo | 2 vCPU | 4GB | Yes | More expensive |
| Google Cloud Run | Managed | ~$25-30/mo | Auto | Auto | Managed | Auto-scaling |
| Render | Pro | $25/mo | Managed | 2GB | Managed | Easy but limited |

---

## Why Not Shared CPU?

| Shared CPU Risk | Impact on Voice Calls |
|-----------------|----------------------|
| Neighbor CPU spike | Audio delay/stutter |
| Server contention | Dropped WebSocket connections |
| Inconsistent latency | Unnatural conversation flow |
| Peak hours slowdown | Missed calls during busy periods |

**B2B impact:** One bad call experience = lost business client.

---

## Capacity Estimates

| Business Clients | Peak Concurrent Calls | Recommended |
|------------------|----------------------|-------------|
| 5-20 | 10-40 | Hetzner CCX13 ($14/mo) |
| 20-50 | 40-100 | Hetzner CCX23 ($27/mo) |
| 50+ | 100+ | Google Cloud Run (auto-scale) |

---

## Cost Comparison (Annual)

| Provider | Monthly | Annual | Notes |
|----------|---------|--------|-------|
| Hostinger KVM 4 | $13 | $156 | Shared CPU - not recommended |
| **Hetzner CCX13** | **$14** | **$168** | **Best value - dedicated** |
| Hetzner CCX23 | $27 | $324 | Higher capacity |
| Google Cloud Run | ~$30 | ~$360 | Auto-scaling + $300 credits available |

---

## Recommendation

### Phase 1: Launch (Now)
**Hetzner CCX13 - $14/month**
- Dedicated 2 vCPU, 8GB RAM
- Handles 25-50 concurrent calls
- Professional grade for B2B

### Phase 2: Scale (When needed)
**Google Cloud Run**
- Use existing $300 GCP credits
- Auto-scales with demand
- No manual capacity planning

---

## Decision Matrix

| Factor | Hostinger | Hetzner | Cloud Run |
|--------|-----------|---------|-----------|
| Price | $13/mo | $14/mo | ~$30/mo |
| CPU Type | Shared | **Dedicated** | Managed |
| Voice Quality | Risky | **Reliable** | **Reliable** |
| Auto-scale | No | No | **Yes** |
| B2B Ready | No | **Yes** | **Yes** |

---

## Conclusion

**Do not use Hostinger** for production voice AI. The $1/month savings is not worth the risk of poor call quality with B2B clients.

**Hetzner CCX13 at $14/month** provides dedicated CPU at nearly the same price as Hostinger's shared option, making it the clear choice for launch.

---

*Report prepared for Lumentra management review.*
