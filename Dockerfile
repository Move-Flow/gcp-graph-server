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

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies and Prisma as a development dependency
RUN pnpm install --prod && \
    pnpm add -D prisma@5.10.0

# Copy prisma schema and generated client
COPY prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["pnpm", "start"] 