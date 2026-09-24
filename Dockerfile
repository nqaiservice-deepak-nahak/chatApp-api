# -----------------------------
# Stage 1 - Build
# -----------------------------
FROM node:22-alpine AS builder
====
# =========================
# Stage 1: B

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies required for building
RUN npm ci

# Copy source code
COPY . .

RUN npm run build


# -----------------------------
# Stage 2 - Production
# -----------------------------
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
