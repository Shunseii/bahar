import { z } from "zod";
import type { ShowAntonymsMode } from "./types";

/**
 * @file Per-face flashcard layout: which dictionary fields a card side shows,
 * and in what order.
 */

/**
 * Morphology is spread across one id per property rather than a single
 * "morphology" field: a user who wants the plural on the question side but not
 * the gender has to be able to say so.
 */
export const CARD_FIELD_IDS = [
  "tags",
  "word",
  "translation",
  "definition",
  "type",
  "gender",
  "inflection",
  "singular",
  "dual",
  "plurals",
  "past_tense",
  "present_tense",
  "imperative",
  "active_participle",
  "passive_participle",
  "masadir",
  "verb_form",
  "huroof",
  "root",
  "examples",
  "antonyms",
] as const;

export type CardFieldId = (typeof CARD_FIELD_IDS)[number];

/**
 * Every entry generates a forward card and a reverse card, each with a question
 * and an answer side -- four independently configurable faces.
 */
export const CARD_FACES = [
  "forward_question",
  "forward_answer",
  "reverse_question",
  "reverse_answer",
] as const;

export type CardFace = (typeof CARD_FACES)[number];

/**
 * The field a face can never hide: the prompt on a question side, the answer on
 * an answer side. Without it a face could render blank.
 */
export const REQUIRED_FIELD_BY_FACE: Record<CardFace, CardFieldId> = {
  forward_question: "word",
  forward_answer: "translation",
  reverse_question: "translation",
  reverse_answer: "word",
};

/**
 * Field ids are stored as plain strings rather than an enum: web and mobile
 * sync the same row while running different releases, so a layout written by a
 * newer client must not fail validation on an older one. Unknown ids are
 * dropped at resolve time instead.
 */
export const CardLayoutSchema = z.object({
  version: z.literal(1),
  faces: z.partialRecord(z.enum(CARD_FACES), z.array(z.string())),
});

export type CardLayout = z.infer<typeof CardLayoutSchema>;

/**
 * The layout that reproduces what cards rendered before this setting existed.
 * Antonym placement follows the older `show_antonyms_in_flashcard` setting, so
 * a user who never opens the editor sees no change: "hint" put antonyms on the
 * side showing the Arabic word, "answer" on the side revealing the meaning.
 */
export const buildDefaultCardLayout = (
  showAntonyms: ShowAntonymsMode = "hidden"
): CardLayout => {
  const onHintSide = showAntonyms === "hint" ? (["antonyms"] as const) : [];
  const onAnswerSide = showAntonyms === "answer" ? (["antonyms"] as const) : [];

  // Everything the entry knows about the word's form, in the order the answer
  // side has always listed it.
  const morphology = [
    "type",
    "gender",
    "inflection",
    "singular",
    "dual",
    "plurals",
    "past_tense",
    "present_tense",
    "imperative",
    "active_participle",
    "passive_participle",
    "masadir",
    "verb_form",
    "huroof",
  ] as const;

  // A question side leads with the prompt and stays sparse: the forms that hint
  // at the word without giving it away, and nothing else.
  const questionHints = ["plurals", "singular", "masadir"] as const;

  return {
    version: 1,
    faces: {
      forward_question: [
        "tags",
        "word",
        "type",
        ...questionHints,
        "root",
        ...onHintSide,
        "examples",
      ],
      forward_answer: [
        "tags",
        "translation",
        "definition",
        ...morphology,
        "root",
        "examples",
        ...onAnswerSide,
      ],
      reverse_question: ["tags", "translation", "type", ...onAnswerSide],
      reverse_answer: [
        "tags",
        "word",
        "translation",
        "definition",
        ...morphology,
        "root",
        "examples",
        ...onHintSide,
      ],
    },
  };
};

const isKnownField = (id: string): id is CardFieldId =>
  (CARD_FIELD_IDS as readonly string[]).includes(id);

/**
 * The ordered fields to render for one face.
 *
 * A stored layout wins over the defaults, but is sanitised first: unknown ids
 * (written by a newer client) and duplicates are dropped, and the face's
 * required field is restored if a bad payload removed it.
 */
export const resolveCardFace = ({
  layout,
  face,
  showAntonyms,
}: {
  layout?: CardLayout | null;
  face: CardFace;
  showAntonyms?: ShowAntonymsMode;
}): CardFieldId[] => {
  const stored = layout?.faces?.[face];
  const fields =
    stored ?? buildDefaultCardLayout(showAntonyms).faces[face] ?? [];

  const resolved = [...new Set(fields.filter(isKnownField))];
  const required = REQUIRED_FIELD_BY_FACE[face];

  return resolved.includes(required) ? resolved : [required, ...resolved];
};

/**
 * The fields a face is not showing, in a stable order for the settings editor.
 */
export const hiddenCardFields = (visible: CardFieldId[]): CardFieldId[] =>
  CARD_FIELD_IDS.filter((id) => !visible.includes(id));
