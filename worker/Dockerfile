FROM node:20-bookworm-slim

# Build tools required by better-sqlite3 (native addon)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies before copying source so this layer
# is cached between builds when only dist/ changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install Chromium and its OS-level dependencies using the exact
# browser version pinned by the npm package.
RUN npx playwright install --with-deps chromium

# Compiled framework — rebuilt by CI before the Docker build step.
COPY dist/ ./dist/

# Config file needed by playwright.config.ts at runtime.
COPY playwright.config.ts ./

COPY worker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
