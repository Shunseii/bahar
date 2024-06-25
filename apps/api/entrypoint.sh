#!/bin/sh

# Run the migration
node dist/db/migrate.mjs

# Run the development server
exec node dist/index.mjs
