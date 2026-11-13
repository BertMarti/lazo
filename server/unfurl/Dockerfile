# Servicio interno de vista previa de enlaces (anti-SSRF). Contexto de build: la raíz del repo.
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY src ./src
RUN npx esbuild src/core/meta.ts --bundle --format=esm --platform=node --outfile=meta.mjs \
 && npx esbuild src/core/amazonServidor.ts --bundle --format=esm --platform=node --outfile=amazon.mjs

FROM node:24-alpine
WORKDIR /app
COPY server/unfurl/guard.mjs server/unfurl/fetch.mjs server/unfurl/index.mjs server/unfurl/wishlist.mjs ./
COPY --from=build /src/meta.mjs /src/amazon.mjs ./
USER node
ENV PORT=8787
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "index.mjs"]
