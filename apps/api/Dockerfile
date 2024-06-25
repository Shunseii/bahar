FROM node:20-slim AS base

ARG PORT

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

FROM base AS prune

RUN npm install -g pnpm
RUN pnpm add -g turbo

COPY . .

RUN turbo prune api --docker

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

RUN chmod +x /app/entrypoint.sh

WORKDIR /app/apps/api

EXPOSE $PORT

ENTRYPOINT ["/app/entrypoint.sh"]
