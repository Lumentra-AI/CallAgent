/**
 * Middleware exports
 */

export {
  authMiddleware,
  userAuthMiddleware,
  optionalAuthMiddleware,
  requireRole,
  getAuthTenantId,
  getAuthUserId,
  getAuthContext,
  type AuthContext,
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
