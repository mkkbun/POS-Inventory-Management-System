# backend.Dockerfile - Build and compile backend service
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# Compile API routes and schemas
RUN npx tsc --noEmit

# Stage 2 - Execute slim runtime
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.ts ./
RUN npm ci --only=production

EXPOSE 5000
CMD ["node", "server.ts"]
