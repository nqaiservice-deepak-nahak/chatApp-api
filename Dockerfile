# =========================
# Stage 1: Build
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies required for building
RUN npm ci

# Copy source code
COPY . .

# Build NestJS application
RUN npm run build


# =========================
# Stage 2: Production
# =========================
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy only the compiled application
COPY --from=builder /app/dist ./dist

EXPOSE 8000

CMD ["node", "dist/main.js"]
