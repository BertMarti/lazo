# Servicio interno de vista previa de enlaces (anti-SSRF). Sin dependencias: solo Node.
FROM node:24-alpine
WORKDIR /app
COPY guard.mjs fetch.mjs meta.mjs index.mjs ./
USER node
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "index.mjs"]
