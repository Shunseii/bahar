#!/bin/sh

# Run the migration
node dist/db/migrate.js

# Run the development server
exec node dist/index
