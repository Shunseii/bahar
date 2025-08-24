# Bahar

This is the monorepo for the Bahar application. It is set up using pnpm workspaces and turborepo.

Bahar is an online personal dictionary. Currently it only supports English - Arabic.

It allows you to build up your own dictionary that's powered by a search engine.

## Getting Started

First, get the environment variables from Infisical.

Then, run `docker compose up` to run all the services in development mode.

Now, the front end application will be available on `http://localhost:4000`.

To run a production setup locally, use `make prod`.

## Projects

### Web

This is a front end SPA using Vite and React.

It uses Shadcn and Tailwindcss for styling.

Client side routing is done using tanstack router and async state management with tanstack query. Atomic state management is done with Jotai.

It uses Cloudflare Pages for hosting. Local setup is done with wrangler cli.

### API

This is a Node.js server using TRPC. It shares the trpc client with the front end.

The primary database is libsql (turso) but also uses redis (upstash) for caching and rate limiting.

Libsql persists data to the local disk. If you run it outside of docker, it will save the data to `apps/api/local.db`.

It uses drizzle ORM to interact with the database and better-auth for handling authentication.

### Search Engine

This project contains the Dockerfile for Meilisearch and the configuration to deploy it on Fly.io.

### Mobile

This is a React Native project which largely uses the same tools as the web app.

## I18n

Internationalization (i18n) is done using LinguiJS and managed mainly in the `i18n` package.

All the extracted translations for all apps live in this package.

To extract new translations, run `pnpm run i18n:extract` in the root directory.

After that, manually add the translations in the `.po` files.

Lastly, run `pnpm run i18n:compile` in the root directory to compile the translations into the `.ts` files which the apps can use.
