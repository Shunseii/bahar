# Bahar Search (Deprecated)

**Note**: This directory is deprecated. The application has migrated to Orama for client-side full-text search.

## Migration

Previously, Bahar used Meilisearch as a centralized search service. The architecture has changed to use:

- **Orama**: Client-side WASM-based full-text search engine
- **Location**: `/apps/web/src/lib/search/index.ts`
- **Data Source**: Local Turso database indexed on app initialization
- **Benefits**: No network latency for searches, works offline, reduced server load

For search functionality, see the web app documentation.
