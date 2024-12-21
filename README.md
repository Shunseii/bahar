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

### Api

This is a Node.js server using TRPC. It shares the trpc client with the front end.

The primary database is libsql (turso) but also uses redis (upstash) for caching and rate limiting.

Libsql persists data to the local disk. If you run it outside of docker, it will save the data to `apps/api/local.db`.

It uses drizzle ORM to interact with the database and better-auth for handling authentication.
