FROM node:20-alpine AS base

ARG PORT
ARG VITE_API_BASE_URL
ARG VITE_MEILISEARCH_API_KEY
ARG VITE_MEILISEARCH_API_URL

ENV PORT $PORT
ENV VITE_API_BASE_URL $VITE_API_BASE_URL
ENV VITE_MEILISEARCH_API_KEY $VITE_MEILISEARCH_API_KEY
ENV VITE_MEILISEARCH_API_URL $VITE_MEILISEARCH_API_URL

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

