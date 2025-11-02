FROM node:24-slim AS builder

WORKDIR /app

# Install build dependencies for native modules (hnswlib-node, etc.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

# Disable git hooks/husky and other lifecycle scripts during image build
ENV HUSKY=0

# Install JS dependencies and prune dev dependencies for a lean build
ARG ACTUAL_API_VERSION
ARG GIT_SHA
ARG APP_VERSION
COPY package*.json ./
RUN if [ -n "$ACTUAL_API_VERSION" ]; then \
      npm pkg set dependencies.@actual-app/api=$ACTUAL_API_VERSION && \
      npm install --package-lock-only; \
    fi && \
    npm ci --omit=dev --ignore-scripts

# Copy application source
COPY . .

FROM node:24-slim AS runner

WORKDIR /app

# Copy application and dependencies from build stage
COPY --from=builder /app /app

# Useful metadata
ARG ACTUAL_API_VERSION
ARG GIT_SHA
ARG APP_VERSION
LABEL org.opencontainers.image.revision="$GIT_SHA" \
      org.opencontainers.image.version="$APP_VERSION" \
      io.actual.api.version="$ACTUAL_API_VERSION"

# Default command: run the cron-based daemon
CMD ["npm", "run", "daemon"]
