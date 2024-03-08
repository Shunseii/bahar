# Bahar

Bahar is an online web app that allows students to build up their own Arabic dictionary.

## Getting Started

Install packages with `pnpm install`.

Run the local database `turso dev`.

Run the migrations `npm run drizzle:migrate` in the `packages/api` directory.

Run the dev servers `turbo dev`.

As you're working through the app, run `npm run messages:extract` to extract any new labels from the code into the `.po` files.

Then, when you are building the appm run `npm run messages:compile` to prepare for a production build.
