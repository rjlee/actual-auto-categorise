FROM node:20-bullseye-slim

# Create app directory
WORKDIR /app

# Install build dependencies for native modules (hnswlib-node, etc.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install JS dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy rest of the source
COPY . .

# Default command: run the cron-based daemon
CMD ["npm", "run", "daemon"]