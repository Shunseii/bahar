local-db:
	# Must have turso cli installed locally
	turso dev --db-file apps/api/local.db

# Serve production web app
serve:
	# Must have caddy installed locally
	PORT=4000 caddy run --config apps/web/Caddyfile
