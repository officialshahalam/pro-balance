# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy prisma schema
COPY prisma ./prisma/

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --prod

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY dist ./dist 
COPY src/assets ./src/assets
COPY swagger-output.json ./swagger-output.json

# --- Production Stage ---
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy files from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/src/assets ./src/assets
COPY --from=builder --chown=nodejs:nodejs /app/swagger-output.json ./swagger-output.json
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Switch to non-root user
USER nodejs

# Expose the correct port
EXPOSE 4000

# Use dumb-init to handle signals properly
CMD ["node", "dist/main.js"]