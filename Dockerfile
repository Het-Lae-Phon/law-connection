# Build and run the law portal web app.
# The SQLite database is NOT baked into the image: on first boot the entrypoint
# downloads a snapshot (DB_SNAPSHOT_URL, e.g. a GitHub Release asset) into the
# mounted volume at /data.
FROM node:24-slim AS builder
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
ENV DATABASE_URL="file:/data/dev.db"
RUN npx prisma generate && npm run build

FROM node:24-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATABASE_URL="file:/data/dev.db"
EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
