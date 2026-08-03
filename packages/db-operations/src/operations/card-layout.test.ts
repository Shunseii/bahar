import {
  buildDefaultCardLayout,
  type CardLayout,
  hiddenCardFields,
  resolveCardFace,
} from "@bahar/drizzle-user-db-schemas";
import { describe, expect, it } from "vitest";

describe("buildDefaultCardLayout", () => {
  it("keeps antonyms off every face when the older setting hides them", () => {
    const layout = buildDefaultCardLayout("hidden");

    for (const fields of Object.values(layout.faces)) {
      expect(fields).not.toContain("antonyms");
    }
  });

  it("puts antonyms on the Arabic-showing faces in hint mode", () => {
    const { faces } = buildDefaultCardLayout("hint");

    expect(faces.forward_question).toContain("antonyms");
    expect(faces.reverse_answer).toContain("antonyms");
    expect(faces.forward_answer).not.toContain("antonyms");
    expect(faces.reverse_question).not.toContain("antonyms");
  });

  it("puts antonyms on the meaning-revealing faces in answer mode", () => {
    const { faces } = buildDefaultCardLayout("answer");

    expect(faces.forward_answer).toContain("antonyms");
    expect(faces.reverse_question).toContain("antonyms");
    expect(faces.forward_question).not.toContain("antonyms");
    expect(faces.reverse_answer).not.toContain("antonyms");
  });
});

describe("resolveCardFace", () => {
  it("falls back to the defaults when no layout is stored", () => {
    expect(resolveCardFace({ layout: null, face: "forward_question" })).toEqual(
      [
        "tags",
        "word",
        "type",
        "plurals",
        "singular",
        "masadir",
        "root",
        "examples",
      ]
    );
  });

  it("uses the stored order over the defaults", () => {
    const layout: CardLayout = {
      version: 1,
      faces: { forward_answer: ["translation", "definition"] },
    };

    expect(resolveCardFace({ layout, face: "forward_answer" })).toEqual([
      "translation",
      "definition",
    ]);
  });

  it("falls back per face, so an unconfigured face keeps its defaults", () => {
    const layout: CardLayout = {
      version: 1,
      faces: { forward_answer: ["translation"] },
    };

    expect(resolveCardFace({ layout, face: "reverse_answer" })).toContain(
      "past_tense"
    );
  });

  it("drops ids a newer client wrote that this build cannot render", () => {
    const layout = {
      version: 1,
      faces: { forward_answer: ["translation", "hologram"] },
    } as CardLayout;

    expect(resolveCardFace({ layout, face: "forward_answer" })).toEqual([
      "translation",
    ]);
  });

  it("drops duplicates", () => {
    const layout: CardLayout = {
      version: 1,
      faces: { forward_question: ["word", "root", "word"] },
    };

    expect(resolveCardFace({ layout, face: "forward_question" })).toEqual([
      "word",
      "root",
    ]);
  });

  it("restores the required field when a payload leaves the face without it", () => {
    const layout: CardLayout = {
      version: 1,
      faces: { forward_answer: ["definition"] },
    };

    expect(resolveCardFace({ layout, face: "forward_answer" })).toEqual([
      "translation",
      "definition",
    ]);
  });

  it("never returns an empty face", () => {
    const layout: CardLayout = { version: 1, faces: { reverse_question: [] } };

    expect(resolveCardFace({ layout, face: "reverse_question" })).toEqual([
      "translation",
    ]);
  });

  it("honours the antonyms setting only while no layout is stored", () => {
    expect(
      resolveCardFace({
        layout: null,
        face: "forward_answer",
        showAntonyms: "answer",
      })
    ).toContain("antonyms");

    const layout: CardLayout = {
      version: 1,
      faces: { forward_answer: ["translation", "definition"] },
    };

    expect(
      resolveCardFace({
        layout,
        face: "forward_answer",
        showAntonyms: "answer",
      })
    ).not.toContain("antonyms");
  });
});

describe("hiddenCardFields", () => {
  it("returns the fields a face is not showing", () => {
    const hidden = hiddenCardFields(["word", "translation"]);

    expect(hidden).not.toContain("word");
    expect(hidden).not.toContain("translation");
    expect(hidden).toContain("definition");
    // Morphology is granular, so each property is hideable on its own.
    expect(hidden).toContain("gender");
    expect(hidden).toContain("plurals");
    expect(hidden).toContain("huroof");
  });
});
