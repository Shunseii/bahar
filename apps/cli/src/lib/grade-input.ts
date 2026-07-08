import type { Grade } from "ts-fsrs";
import { GRADE_LABELS, parseGradeLabel } from "./grade";

export type GradeItem = {
  id: string;
  gradeLabel: string;
  grade: Grade;
};

const resolve = ({ id, gradeLabel }: { id: string; gradeLabel: string }) => {
  const grade = parseGradeLabel(gradeLabel);
  if (grade === undefined) {
    throw new Error(
      `Invalid grade "${gradeLabel}" for card "${id}". Use one of: ${GRADE_LABELS}.`
    );
  }
  return { id, gradeLabel: gradeLabel.toLowerCase(), grade };
};

const parseStdin = (stdin: string): { id: string; gradeLabel: string }[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdin);
  } catch {
    throw new Error(
      'Could not parse stdin as JSON. Expected an array like [{"id": "...", "grade": "good"}].'
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      'Expected a JSON array of {"id", "grade"} objects on stdin.'
    );
  }

  return parsed.map((entry, index) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as Record<string, unknown>).id !== "string" ||
      typeof (entry as Record<string, unknown>).grade !== "string"
    ) {
      throw new Error(
        `Entry at index ${index} must be an object with string "id" and "grade" fields.`
      );
    }
    const { id, grade } = entry as { id: string; grade: string };
    return { id, gradeLabel: grade };
  });
};

/**
 * Resolves the cards-to-grade for `grade` from either:
 *
 * - positional args `<id...> <grade>` — the grade is always the last argument,
 *   so `grade <id> <grade>` (one card) and `grade <id1> <id2> <grade>` (many,
 *   same grade) share one shape, or
 * - a JSON array `[{"id", "grade"}]` piped on stdin — for per-card grades.
 *
 * Positional args take precedence when present. Throws on an unknown grade,
 * a malformed stdin payload, or a duplicate card id.
 */
export const parseGradeInput = ({
  positional,
  stdin,
}: {
  positional: string[];
  stdin: string | null;
}): GradeItem[] => {
  let raw: { id: string; gradeLabel: string }[];

  if (positional.length > 0) {
    const gradeLabel = positional[positional.length - 1];
    const ids = positional.slice(0, -1);
    if (ids.length === 0) {
      throw new Error(
        `Provide at least one card id: bahar grade <id...> <grade>. Grades: ${GRADE_LABELS}.`
      );
    }
    raw = ids.map((id) => ({ id, gradeLabel }));
  } else if (stdin && stdin.trim().length > 0) {
    raw = parseStdin(stdin);
  } else {
    return [];
  }

  const items = raw.map(resolve);

  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) {
      throw new Error(`Duplicate card id "${id}" in batch.`);
    }
    seen.add(id);
  }

  return items;
};
