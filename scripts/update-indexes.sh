#!/usr/bin/env bash

set -e

if [ -z "$MEILISEARCH_HOST" ] || [ -z "$MEILISEARCH_MASTER_KEY" ]; then
  echo "Please set the MEILISEARCH_HOST and MEILISEARCH_MASTER_KEY environment variables."
  exit 1
fi

FILTERABLE_ATTRIBUTES='["flashcard.due_timestamp", "tags", "type"]'

# The maximinum number of hits to return for a search query.
MAX_TOTAL_HITS=2000

echo "Updating indexes for all users..."
echo

# Fetch all indexes
INDEXES=$(curl -s -X GET "$MEILISEARCH_HOST/indexes?limit=1000" -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" | jq -r '.results[].uid')

echo "Found indexes: "
echo [$INDEXES]
echo

for index in $INDEXES; do
  echo "Updating filterable attributes for index: $index"
  # Update filterable attributes
  response=$(curl \
    -X PUT "$MEILISEARCH_HOST/indexes/$index/settings/filterable-attributes" \
    -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
    -H "Content-Type: application/json" \
    -s \
    --data-binary "$FILTERABLE_ATTRIBUTES")

  if [[ $response =~ "code" && $response =~ "type" ]]; then
    echo $response | jq
    echo "Error updating filterable attributes for index: $index"
    exit 1
  fi

  echo "Updating pagination settings for index: $index"
  # Update pagination settings
  response=$(curl \
    -X PATCH "$MEILISEARCH_HOST/indexes/$index/settings/pagination" \
    -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
    -H "Content-Type: application/json" \
    -s \
    --data-binary '{ "maxTotalHits": '$MAX_TOTAL_HITS' }')

  if [[ $response =~ "code" && $response =~ "type" ]]; then
    echo $response | jq
    echo "Error updating pagination settings for index: $index"
    exit 1
  fi

  echo
done

echo "Successfully updated indexes for all users."
