ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

ARG PORT

ARG SENTRY_API_AUTH_TOKEN
ARG SENTRY_API_PROJECT
ARG SENTRY_ORG
ARG GITHUB_SHA

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

FROM base AS prune

RUN npm install -g pnpm
RUN pnpm add -g turbo

COPY . .

RUN turbo prune api --docker

FROM base AS development

# Add certificates so we can call Sentry's API
RUN apt-get update && apt-get install -y ca-certificates

RUN npm install -g pnpm
RUN pnpm add -g turbo

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

# Build the project
COPY --from=prune /app/out/full/ .

# Environment variables needed for Sentry esbuild plugin
# which will create a new release and upload sourcemaps
ENV SENTRY_API_AUTH_TOKEN=$SENTRY_API_AUTH_TOKEN
ENV SENTRY_API_PROJECT=$SENTRY_API_PROJECT
ENV SENTRY_ORG=$SENTRY_ORG
ENV GITHUB_SHA=$GITHUB_SHA

RUN pnpm turbo run build --filter=api

FROM base AS production

RUN npm install -g pnpm
RUN pnpm add -g turbo

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY .gitignore .gitignore
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --prod --frozen-lockfile

COPY --from=development /app/apps/api/dist /app/apps/api/dist
COPY --from=development /app/apps/api/entrypoint.sh ./

COPY --from=prune /app/turbo.json /app/turbo.json

# Needed for migrations
COPY --from=prune /app/apps/api/drizzle /app/apps/api/drizzle
COPY --from=prune /app/apps/api/instrument.mjs /app/apps/api/instrument.mjs
COPY --from=prune /app/apps/api/src/*.json /app/apps/api/dist/

RUN chmod +x /app/entrypoint.sh

WORKDIR /app/apps/api

EXPOSE $PORT

ENTRYPOINT ["/app/entrypoint.sh"]
