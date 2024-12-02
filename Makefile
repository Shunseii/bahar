local-db:
	# Must have turso cli installed locally
	turso dev --db-file apps/api/local.db

# Serve production web app
serve:
	pnpm run --filter web wrangler:dev --port 4000

# Run production application 
prod:
	docker compose -f docker-compose.prod.yaml up -d
	make serve || (docker compose -f docker-compose.prod.yaml down && exit 1)
	
cleanup:
	docker compose -f docker-compose.prod.yaml down

.PHONY: prod cleanup
