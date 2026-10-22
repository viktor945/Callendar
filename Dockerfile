FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html tsconfig*.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24.19.0-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/calendar.sqlite
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
# The Node server shares TypeScript data and iCalendar helpers with the client.
COPY --chown=node:node src ./src
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
