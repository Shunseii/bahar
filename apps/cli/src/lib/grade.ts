/**
 * Grade labels as the API accepts them. Scheduling itself happens server-side
 * -- the CLI only validates the label a user typed and passes it through.
 */
export const GRADE_LABEL_VALUES = ["again", "hard", "good", "easy"] as const;

export type GradeLabel = (typeof GRADE_LABEL_VALUES)[number];

export const GRADE_LABELS = GRADE_LABEL_VALUES.join(" | ");

const isGradeLabel = (value: string): value is GradeLabel =>
  (GRADE_LABEL_VALUES as readonly string[]).includes(value);

/** Resolves a user-supplied grade label, or `undefined` if it isn't one. */
export const parseGradeLabel = (raw: string): GradeLabel | undefined => {
  const normalized = raw.toLowerCase();

  return isGradeLabel(normalized) ? normalized : undefined;
};
