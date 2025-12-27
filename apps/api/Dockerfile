ARG BUN_VERSION=1.3.5
FROM oven/bun:${BUN_VERSION}-slim AS base

LABEL fly_launch_runtime="Bun"

ARG GITHUB_SHA

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

FROM base AS prune

RUN bun add -g pnpm turbo

COPY . .

RUN turbo prune api --docker

FROM base AS build

RUN bun add -g pnpm turbo

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm config set store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copy full source
COPY --from=prune /app/out/full/ .

WORKDIR /app/apps/api

ENV NODE_ENV=production

# Compile server binary
RUN bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --external @libsql/linux-x64-gnu \
    --outfile server \
    src/index.ts

# Compile migrate binary
RUN bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --external @libsql/linux-x64-gnu \
    --outfile migrate \
    src/db/migrate.ts

FROM debian:12-slim

WORKDIR /app

# Copy compiled binaries
COPY --from=build /app/apps/api/server server
COPY --from=build /app/apps/api/migrate migrate

# Copy native libsql module (required at runtime)
COPY --from=build /app/node_modules/@libsql/linux-x64-gnu ./node_modules/@libsql/linux-x64-gnu

# Copy drizzle migrations folder (needed at runtime)
COPY --from=build /app/apps/api/drizzle drizzle

ENV NODE_ENV=production
ARG GITHUB_SHA
ENV GITHUB_SHA=$GITHUB_SHA

EXPOSE 3000

CMD ["./server"]
