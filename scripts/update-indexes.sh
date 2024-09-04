#!/usr/bin/env bash

set -e

if [ -z "$MEILISEARCH_HOST" ] || [ -z "$MEILISEARCH_MASTER_KEY" ]; then
  echo "Please set the MEILISEARCH_HOST and MEILISEARCH_MASTER_KEY environment variables."
  exit 1
fi

FILTERABLE_ATTRIBUTES='["flashcard.due_timestamp", "tags", "type"]'

echo "Updating indexes for all users..."

# Fetch all indexes
INDEXES=$(curl -s -X GET "$MEILISEARCH_HOST/indexes?limit=1000" -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" | jq -r '.results[].uid')

echo "Found indexes: "
echo [$INDEXES]

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
done

echo "Successfully updated indexes for all users."
