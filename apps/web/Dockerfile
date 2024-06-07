FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

FROM base AS prune

RUN npm install -g pnpm
RUN pnpm add -g turbo

COPY . .

RUN turbo prune web --docker

FROM base AS development

RUN npm install -g pnpm
RUN pnpm add -g turbo

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

# Build the project
COPY --from=prune /app/out/full/ .
RUN pnpm turbo run build --filter=web

FROM base AS production

RUN npm install -g pnpm
RUN pnpm add -g turbo

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY .gitignore .gitignore
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --prod --frozen-lockfile

COPY --from=development /app/apps/web/dist /app/apps/web/dist
COPY --from=prune /app/turbo.json /app/turbo.json

RUN apk add --no-cache ca-certificates

# Install Caddy
RUN wget -qO- "https://github.com/caddyserver/caddy/releases/download/v2.4.5/caddy_2.4.5_linux_amd64.tar.gz" \
    | tar --no-same-owner -C /usr/bin/ -xz caddy

COPY --from=prune /app/apps/web/Caddyfile /app/apps/web/Caddyfile

EXPOSE 80

ENV PORT=80

CMD ["caddy", "run", "--config", "/app/apps/web/Caddyfile"]
