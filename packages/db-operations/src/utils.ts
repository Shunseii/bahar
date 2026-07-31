/**
 * SQL utility functions for database operations.
 */

import {
  dictionaryEntries,
  type TagMode,
} from "@bahar/drizzle-user-db-schemas";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid/non-secure";

/**
 * Columns that contain JSON data and should not be escaped.
 */
const JSON_COLUMNS = ["root", "tags", "antonyms", "examples", "morphology"];

/**
 * Restricts dictionary entries to those matching `tags`.
 *
 * Non-correlated subquery, not `EXISTS (json_each(...))`. The correlated form
 * re-runs json_each per candidate row, which the WASM SQLite build evaluates
 * pathologically slowly for filters matching many rows (effectively hangs,
 * wedging the single connection). Materializing the matching entry ids once
 * keeps it in the tens of ms.
 *
 * `"any"` matches entries carrying at least one of the tags, `"all"` requires
 * every one. `all` counts DISTINCT values so an entry that repeats a tag in its
 * JSON array still has to carry every filter tag, and the caller's tags are
 * de-duplicated so a repeated filter tag doesn't inflate the required count
 * past what any entry can reach.
 */
export const buildTagCondition = ({
  tags,
  mode,
}: {
  tags: string[];
  mode: TagMode;
}) => {
  const uniqueTags = [...new Set(tags)];
  const tagList = sql.join(
    uniqueTags.map((tag) => sql`${tag}`),
    sql`, `
  );

  if (mode === "all") {
    return sql`${dictionaryEntries.id} IN (SELECT de_t.id FROM dictionary_entries de_t, json_each(de_t.tags) jt WHERE jt.value IN (${tagList}) GROUP BY de_t.id HAVING COUNT(DISTINCT jt.value) = ${uniqueTags.length})`;
  }

  return sql`${dictionaryEntries.id} IN (SELECT de_t.id FROM dictionary_entries de_t, json_each(de_t.tags) jt WHERE jt.value IN (${tagList}))`;
};

/**
 * Generates a SQL json_object clause from column names.
 * Handles JSON columns differently to preserve their structure.
 *
 * @example
 * // Input
 * columns = ['id', 'word', 'tags']
 * tableAlias = 'd'
 * jsonObjectAlias = 'dictionary_entry'
 *
 * // Output
 * "json_object('id', REPLACE(REPLACE(d.id, '\\', '\\\\'), '"', '\\"'), 'word', ..., 'tags', d.tags) as dictionary_entry"
 */
export const buildSelectWithNestedJson = ({
  columns,
  tableAlias,
  jsonObjectAlias,
}: {
  columns: string[];
  tableAlias: string;
  jsonObjectAlias: string;
}): string => {
  const jsonPairs = columns
    .map((col) => {
      if (JSON_COLUMNS.includes(col)) {
        // JSON columns should be used directly without escaping
        return `'${col}', ${tableAlias}.${col}`;
      }
      // Escape backslashes and quotes in string columns
      return `'${col}', REPLACE(REPLACE(${tableAlias}.${col}, '\\', '\\\\'), '"', '\\"')`;
    })
    .join(", ");

  return `json_object(${jsonPairs}) as ${jsonObjectAlias}`;
};

/**
 * Builds a WHERE IN clause for an array of values.
 */
export const buildInClause = (
  column: string,
  values: unknown[],
  tableAlias?: string
): { clause: string; params: unknown[] } => {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  const placeholders = values.map(() => "?").join(", ");
  return {
    clause: `${prefix}${column} IN (${placeholders})`,
    params: values,
  };
};

/**
 * Builds SET clause for UPDATE statements.
 */
export const buildSetClause = (
  updates: Record<string, unknown>
): { clause: string; params: unknown[] } => {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`);
      params.push(value);
    }
  }

  return {
    clause: setClauses.join(", "),
    params,
  };
};

/**
 * Generates a unique ID using nanoid.
 * Cross-platform compatible (works in browser and React Native).
 */
export const generateId = (): string => {
  return nanoid();
};
