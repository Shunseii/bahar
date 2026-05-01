local-db:
	# Must have turso cli installed locally
	turso dev --db-file apps/api/local.db

# Cloudflared tunnel for local dev — exposes local API over HTTPS
# so the mobile dev client and OAuth callbacks (Apple Sign In) can reach it.
# Requires `cloudflared login` once to fetch credentials for the bahar-dev tunnel.
tunnel:
	cloudflared tunnel run bahar-dev

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

.PHONY: local-db tunnel serve build delete-local-data
