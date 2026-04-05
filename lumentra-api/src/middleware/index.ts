/**
 * Middleware exports
 */

export {
  authMiddleware,
  userAuthMiddleware,
  optionalAuthMiddleware,
  platformAdminAuth,
  requireRole,
  getAuthTenantId,
  getAuthUserId,
  getAuthContext,
  getPlatformAdminContext,
  getServiceClient,
  type AuthContext,
  type PlatformAdminContext,
} from "./auth.js";

export {
  rateLimit,
  strictRateLimit,
  criticalRateLimit,
  readRateLimit,
  tenantRateLimit,
} from "./rate-limit.js";

export { validateWebhookSecret } from "./webhook-auth.js";
export { securityHeaders } from "./security-headers.js";
export { internalAuth } from "./internal-auth.js";
