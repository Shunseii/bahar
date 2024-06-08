# Bahar

This is the monorepo for the Bahar application. It is set up using pnpm workspaces and turborepo.

Bahar is an online personal dictionary. Currently it only supports English - Arabic. 

It allows you to build up your own dictionary that's powered by a search engine. 

Currently, you can only view your dictionary and words only have translations. However, in the future, users will be able to add words themselves and words will have additional metadata like context, examples, root letters, morphology chart, etc...

## Getting Started

Firstly, copy the `.example.env` to `.env` in `api` and `web`.

Then, run `docker-compose up` to run all the services in development mode.

Now, the front end application will be available on `http://localhost:4000`.

To run a production setup locally, use `docker-compose -f docker-compose-prod.yaml up`.

## Projects

### Web

This is a front end SPA using Vite and React.

It uses Shadcn and Tailwindcss for styling.

Client side routing is done using tanstack router and async state managemnet with tanstack query. Atomic state management is done with Jotai.

It also makes use of Caddy as a production web server. The docker-compose-prod builds the app and serves it using Caddy.

### Api

This is a Node.js server using TRPC. It shares the trpc client with the front end.

The primary database is libsql (turso) but also uses redis (upstash) for rate limiting.

Libsql persists data to the local disk. If you run it outside of docker, it will save the data to `apps/api/local.db`.

It uses drizzle ORM to interact with the database and lucia-auth for handling authentication.
