# syntax=docker/dockerfile:1

# One Dockerfile, three targets: shell | people | delivery
FROM node:22-alpine AS workspace
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/shell/package.json apps/shell/
COPY apps/people/package.json apps/people/
COPY apps/delivery/package.json apps/delivery/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY apps apps

FROM workspace AS build-shell
RUN pnpm --filter @baseline/shell build

FROM workspace AS build-people
RUN pnpm --filter @baseline/people build

FROM workspace AS build-delivery
RUN pnpm --filter @baseline/delivery build

FROM nginx:1.27-alpine AS shell
COPY docker/nginx.shell.conf /etc/nginx/templates/default.conf.template
COPY docker/entrypoint-shell.sh /docker-entrypoint.d/40-write-config.sh
RUN chmod +x /docker-entrypoint.d/40-write-config.sh
COPY --from=build-shell /repo/apps/shell/dist /usr/share/nginx/html
ENV PEOPLE_REMOTE_URL=http://localhost:8081/remoteEntry.js \
    DELIVERY_REMOTE_URL=http://localhost:8082/remoteEntry.js

FROM nginx:1.27-alpine AS people
COPY docker/nginx.remote.conf /etc/nginx/templates/default.conf.template
COPY --from=build-people /repo/apps/people/dist /usr/share/nginx/html
ENV ALLOWED_ORIGIN=http://localhost:8080

FROM nginx:1.27-alpine AS delivery
COPY docker/nginx.remote.conf /etc/nginx/templates/default.conf.template
COPY --from=build-delivery /repo/apps/delivery/dist /usr/share/nginx/html
ENV ALLOWED_ORIGIN=http://localhost:8080
