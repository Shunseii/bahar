local-db:
	# Must have turso cli installed locally
	turso dev --db-file apps/api/local.db

# Serve production web app
serve:
	pnpm run --filter web wrangler:dev --port 4000

# Build production web app
build:
	NODE_ENV=production pnpm turbo build --filter=web

# Run production application 
prod: build
	docker compose -f docker-compose.prod.yaml up -d --remove-orphans
	make serve || (make cleanup && exit 1)
	
cleanup:
	docker compose -f docker-compose.prod.yaml down

.PHONY: serve build prod cleanup
