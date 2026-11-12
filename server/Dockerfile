# Lazo: PocketBase + migraciones + hooks + la PWA (pb_public). Contexto de build: la raíz del repo.
FROM node:24-alpine AS web
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm run build:server

FROM alpine:3.22
ARG PB_VERSION=0.40.6
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').zip" -O /tmp/pb.zip \
 && unzip /tmp/pb.zip pocketbase -d /usr/local/bin && rm /tmp/pb.zip \
 && adduser -D -H -u 1000 lazo && mkdir -p /pb/pb_data && chown lazo /pb/pb_data
WORKDIR /pb
COPY server/pb/pb_migrations ./pb_migrations
COPY server/pb/pb_hooks ./pb_hooks
COPY --from=web /src/server/pb/pb_hooks/lib ./pb_hooks/lib
COPY --from=web /src/dist ./pb_public
USER lazo
EXPOSE 8090
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1
CMD ["pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks", "--publicDir=/pb/pb_public"]
