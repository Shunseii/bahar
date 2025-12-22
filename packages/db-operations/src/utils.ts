/**
 * SQL utility functions for database operations.
 */

// Polyfill for React Native (must be imported before nanoid)
import "react-native-get-random-values";
import { nanoid } from "nanoid/non-secure";

/**
 * Columns that contain JSON data and should not be escaped.
 */
const JSON_COLUMNS = ["root", "tags", "antonyms", "examples", "morphology"];

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
      } else {
        // Escape backslashes and quotes in string columns
        return `'${col}', REPLACE(REPLACE(${tableAlias}.${col}, '\\', '\\\\'), '"', '\\"')`;
      }
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
  tableAlias?: string,
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
  updates: Record<string, unknown>,
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
