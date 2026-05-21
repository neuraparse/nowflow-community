FROM node:22-bookworm-slim

# Install native build/runtime tools used by Next.js, Sharp, Drizzle, and pg.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
    git \
    curl \
    postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set environment variables for consistent builds/runtime.
ENV FORCE_COLOR=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NEXT_TELEMETRY_DISABLED=1

# Copy package files first for better caching
COPY package*.json ./
COPY apps/nowflow/package*.json ./apps/nowflow/
COPY packages ./packages

# Use the same npm major pinned by packageManager.
RUN npm install -g npm@11.3.0 \
    && corepack enable

# Set npm configuration for platform compatibility
RUN npm config set prefer-offline false \
    && npm config set audit false \
    && npm config set fund false

# Install dependencies with native optional packages used by Next.js/Turbo/Sharp.
RUN npm ci --include=optional --no-audit --no-fund

# Copy the rest of the application
COPY . ./

# Rebuild native modules to ensure platform compatibility
RUN npm rebuild

# Build the Community Edition app. Database schema changes are applied at
# runtime by operators with `npm --workspace apps/nowflow run db:push`.
RUN npm run build

EXPOSE 3000

# Start the production Next.js server.
ENV NODE_ENV=production
CMD ["npm", "--workspace", "apps/nowflow", "run", "start"]
