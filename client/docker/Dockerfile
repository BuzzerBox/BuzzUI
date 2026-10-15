# Build from the repo root, since the client compiles in shared/ and config.json:
#   docker build -f client/docker/Dockerfile .
# Pass --build-arg CONFIG_OVERRIDE=config.test.json to merge that file into config.json.
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app/client
COPY client/package.json client/package-lock.json client/.npmrc ./
RUN npm ci
COPY shared ../shared
# shared/services/abstract-logger.service.ts imports server/env.ts
COPY server/env.ts ../server/
COPY config.json config.test.json config.dev.json.example version.json ../
COPY scripts/merge-config.js ../scripts/
ARG CONFIG_OVERRIDE=
# config.dev.json is imported by the code (it is only used in dev builds), so it has to exist
RUN cp ../config.dev.json.example ../config.dev.json \
 && if [ -n "$CONFIG_OVERRIDE" ]; then node ../scripts/merge-config.js ../config.json "../$CONFIG_OVERRIDE"; fi
COPY client ./
RUN npm run build

FROM nginx:1.28-alpine
LABEL org.opencontainers.image.description="BuzzerBox web client"
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/client/dist/client/browser /usr/share/nginx/html
COPY client/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
