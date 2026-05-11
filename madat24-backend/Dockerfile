# ─── Build stage ─────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Native build deps for bcryptjs (none) + prisma engines
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# uploads/ is a runtime volume — for production use S3/Cloudinary instead
RUN mkdir -p uploads

EXPOSE 4000

# In prod we use migrate deploy (idempotent, zero-downtime safe)
# instead of db push (only safe for local dev).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
