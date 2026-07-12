/**
 * Resolves the entry ids to delete from either positional args
 * (`bahar delete <id...>`) or a JSON array on stdin -- an array of id strings,
 * or of `{ "id": "..." }` objects. Positional args take precedence. Throws on
 * a malformed stdin payload or a duplicate id.
 */
export const parseDeleteInput = ({
  positional,
  stdin,
}: {
  positional: string[];
  stdin: string | null;
}): string[] => {
  let ids: string[];

  if (positional.length > 0) {
    ids = positional;
  } else if (stdin && stdin.trim().length > 0) {
    ids = parseStdin(stdin);
  } else {
    return [];
  }

  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate id "${id}" in batch.`);
    }
    seen.add(id);
  }

  return ids;
};

const parseStdin = (stdin: string): string[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdin);
  } catch {
    throw new Error(
      'Could not parse stdin as JSON. Expected an array of ids like ["id1", "id2"] or [{"id": "..."}].'
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array of ids on stdin.");
  }

  return parsed.map((entry, index) => {
    if (typeof entry === "string") {
      if (entry.length === 0) {
        throw new Error(`Id at index ${index} is empty.`);
      }
      return entry;
    }
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).id === "string" &&
      (entry as Record<string, string>).id.length > 0
    ) {
      return (entry as Record<string, string>).id;
    }
    throw new Error(
      `Entry at index ${index} must be a non-empty id string or an object with a string "id".`
    );
  });
};
