#!/bin/sh

# Run the migration
node dist/db/migrate.mjs

# Run the development server
exec node --import ./instrument.mjs dist/index.mjs
