# Build from the repo root, since the server compiles in shared/ and config.json:
#   docker build -f server/docker/Dockerfile .
# Pass --build-arg CONFIG_OVERRIDE=config.test.json to merge that file into config.json.
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY shared ../shared
COPY config.json config.test.json config.dev.json.example version.json ../
COPY scripts/merge-config.js ../scripts/
ARG CONFIG_OVERRIDE=
# config.dev.json is imported by the code (it is only used with --dev=1), so it has to exist
RUN cp ../config.dev.json.example ../config.dev.json \
 && if [ -n "$CONFIG_OVERRIDE" ]; then node ../scripts/merge-config.js ../config.json "../$CONFIG_OVERRIDE"; fi
COPY server ./
RUN npm run transpile

FROM node:${NODE_VERSION}-bookworm-slim
LABEL org.opencontainers.image.description="BuzzerBox game server"
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/server/dist ./dist
USER node
# 4201: WebSocket, 4202: media file server
EXPOSE 4201 4202
CMD ["node", "dist/server/main.js"]
