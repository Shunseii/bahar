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

# Also make sure to clean up the "testing" db group 
# in turso as that will have any user dbs that were 
# created even locally.
delete-local-data:
	sudo rm -rf ./libsql
	sudo rm -rf ./meili_data
	sudo rm -rf ./apps/api/local.db*

.PHONY: serve build prod cleanup
