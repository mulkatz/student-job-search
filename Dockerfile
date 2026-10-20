FROM node:24.22.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/experiment/package.json packages/experiment/package.json
COPY packages/discovery/package.json packages/discovery/package.json
COPY packages/server/package.json packages/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --ignore-scripts
COPY packages/experiment packages/experiment
COPY packages/core packages/core
COPY packages/discovery packages/discovery
COPY packages/server packages/server
RUN npm run build --workspace=@job-search/core && npm run build --workspace=@job-search/experiment && npm run build --workspace=@job-search/discovery && npm run build --workspace=@job-search/server && npm prune --omit=dev --ignore-scripts

FROM node:24.22.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core/package.json ./packages/core/package.json
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/experiment/package.json ./packages/experiment/package.json
COPY --from=build /app/packages/experiment/dist ./packages/experiment/dist
COPY --from=build /app/packages/discovery/package.json ./packages/discovery/package.json
COPY --from=build /app/packages/discovery/dist ./packages/discovery/dist
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
ENV NODE_ENV=production
USER node
CMD ["node", "packages/server/dist/main.js"]
