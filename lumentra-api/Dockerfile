# Lumentra API Dockerfile
FROM node:22-alpine AS base

# Install production dependencies only
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Explicitly omit dev deps (--omit=dev replaces deprecated --only=production)
RUN npm ci --omit=dev

# Build stage (force NODE_ENV=development so devDependencies like esbuild are installed)
FROM base AS builder
WORKDIR /app
ENV NODE_ENV=development

# Cache bust - change this value to force rebuild
ARG CACHE_BUST=2026-01-27-v4

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 lumentra

# Copy built files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER lumentra

EXPOSE 3100

ENV PORT=3100

CMD ["node", "dist/index.js"]
