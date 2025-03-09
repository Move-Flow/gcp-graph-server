# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (including devDependencies)
RUN pnpm install

# Copy source code and prisma schema
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY prisma ./prisma

# Install pnpm
RUN npm install -g pnpm

# Copy node_modules from builder to avoid reinstalling
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set default environment variables
ENV PORT=8080
ENV NODE_ENV=production
ENV INSTANCE_CONNECTION_NAME=level-poetry-395302:us-central1:moveflow
# 注意：不要在 Dockerfile 中设置敏感信息如密码
# 这些应该在部署时通过 Cloud Run 设置

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["pnpm", "start"] 