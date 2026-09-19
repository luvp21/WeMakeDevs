# Playwright's official image bundles Chromium + all its native deps —
# avoids hand-rolling headless-browser dependency installation. Tag must
# match the installed playwright npm package version exactly.
FROM mcr.microsoft.com/playwright:v1.63.0-jammy

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# npm workspaces requires every workspace listed in the root package.json to
# exist on disk to resolve at all, even ones we don't build here — copy just
# the manifests for all of them first (small, cacheable), then only the
# actual source for the two workspaces this image needs.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY render/package.json ./render/package.json
RUN npm install

COPY shared ./shared
COPY render ./render
RUN npm run build --workspace shared \
    && npm run build --workspace render

WORKDIR /app/render
CMD ["node", "dist/index.js"]
