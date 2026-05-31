# =========================
# BUILD STAGE
# =========================
FROM node:22-alpine AS builder

WORKDIR /app

# Alinha versão do npm com ambiente local
RUN npm install -g npm@11.6.2

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# =========================
# PRODUCTION STAGE
# =========================
FROM node:22-alpine AS runner

WORKDIR /app

# Alinha versão do npm com ambiente local
RUN npm install -g npm@11.6.2

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy build artifacts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]