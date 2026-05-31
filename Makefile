local-db:
	# Must have turso cli installed locally
	turso dev --db-file apps/api/local.db

# Cloudflared tunnel for local dev — exposes local API over HTTPS
# so the mobile dev client and OAuth callbacks (Apple Sign In) can reach it.
# bahar-dev is a remotely-managed (dashboard) tunnel; cloudflared reads its
# token from the TUNNEL_TOKEN env var. Set it before running, e.g.:
#   export TUNNEL_TOKEN=$(op read 'op://Bahar/Cloudflared tunnel token/password')
tunnel:
	cloudflared tunnel run

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
