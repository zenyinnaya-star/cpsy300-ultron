    # ---- Stage 1: build the app ----
    FROM node:22-alpine AS builder
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY . .
    RUN npm run build

    # ---- Stage 2: small image that only runs it ----
    FROM node:22-alpine
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3000
    ENV HOSTNAME=0.0.0.0
    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder /app/.next/static ./.next/static
    COPY --from=builder /app/public ./public
    COPY --from=builder /app/data ./data
    EXPOSE 3000
    CMD ["node", "server.js"]
    