local-db:
	# Must have turso cli installed locally
	turso dev --db-file apps/api/local.db

# Serve production web app
serve:
	pnpm run --filter web wrangler:dev

# Build production web app
build:
	NODE_ENV=production pnpm turbo build --filter=web

# Also make sure to clean up the "testing" db group
# in turso as that will have any user dbs that were
# created even locally.
delete-local-data:
	sudo rm -rf ./libsql
	sudo rm -rf ./apps/api/local.db*

.PHONY: local-db serve build delete-local-data
