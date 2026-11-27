import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import type { InternalTypedDocument, Results } from "@orama/orama";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createDictionaryDatabase,
  insertDocuments,
  type SearchDictionaryOptions,
  searchDictionary,
} from "./database";
import { toOramaDocument } from "./document";
import type { DictionaryDocument, DictionaryOrama } from "./schema";

let nextTimestamp = 1_767_225_600_000;

const entry = (
  fields: Pick<SelectDictionaryEntry, "id" | "word" | "translation"> &
    Partial<SelectDictionaryEntry>
): SelectDictionaryEntry => {
  nextTimestamp += 1000;
  return {
    created_at: null,
    created_at_timestamp_ms: nextTimestamp,
    updated_at: null,
    updated_at_timestamp_ms: nextTimestamp,
    definition: null,
    type: "ism",
    root: null,
    tags: null,
    antonyms: null,
    examples: null,
    morphology: null,
    ...fields,
  };
};

const ENTRIES = [
  entry({
    id: "hurima",
    word: "حُرِمَ",
    translation: "to be deprived",
    type: "fi'l",
  }),
  entry({ id: "hurma", word: "حُرمَة", translation: "sanctity" }),
  entry({
    id: "bayan",
    word: "بَيَان",
    translation: "statement",
    definition: "ما يُبيَّن به الشيء",
    morphology: {
      ism: { singular: "بَيَان", plurals: [{ word: "بَيَانات" }] },
    },
  }),
  entry({ id: "rajaa-fatha", word: "رَجاءً", translation: "please" }),
  entry({ id: "rajaa", word: "رجاء", translation: "hope" }),
  entry({
    id: "jarraba",
    word: "جرّب",
    translation: "to try",
    type: "fi'l",
    root: ["ج", "ر", "ب"],
  }),
  entry({ id: "jayb", word: "جَيْب", translation: "pocket" }),
  entry({
    id: "damina",
    word: "ضمِن",
    translation: "to guarantee",
    type: "fi'l",
    morphology: {
      verb: {
        huroof: [],
        past_tense: "ضمِن",
        present_tense: "يَضْمَنُ",
        active_participle: "",
        passive_participle: "",
        imperative: "",
        masadir: [{ word: "ضَمان" }],
        form: "",
        form_arabic: "",
      },
    },
  }),
  ...Array.from({ length: 60 }, (_, i) =>
    entry({
      id: `stone-${i}`,
      word: `حجر ${i}`,
      translation: `stone number ${i}`,
    })
  ),
];

let db: DictionaryOrama;

beforeAll(async () => {
  db = createDictionaryDatabase();
  await insertDocuments(
    db,
    ENTRIES.map((e) => toOramaDocument({ entry: e }))
  );
});

const search = (term: string, options: SearchDictionaryOptions) =>
  searchDictionary(db, term, options) as Results<
    InternalTypedDocument<DictionaryDocument>
  >;

const ids = (term: string, language: "arabic" | "english", limit = 10) =>
  search(term, { language, limit }).hits.map((hit) => hit.id);

describe("searchDictionary ranking", () => {
  it("puts an exact headword match first", () => {
    expect(ids("حرمة", "arabic")[0]).toBe("hurma");
  });

  it("finds a headword typed with ال", () => {
    expect(ids("البيان", "arabic")[0]).toBe("bayan");
  });

  it("breaks ties between normalized matches by harakat", () => {
    expect(ids("رجاء", "arabic").slice(0, 2)).toEqual(["rajaa", "rajaa-fatha"]);
    expect(ids("رَجاءً", "arabic")[0]).toBe("rajaa-fatha");
  });

  it("finds an entry through its stored root", () => {
    const results = ids("تجريب", "arabic");
    expect(results).toContain("jarraba");
    const jayb = results.indexOf("jayb");
    if (jayb !== -1) expect(results.indexOf("jarraba")).toBeLessThan(jayb);
  });

  it("finds an entry through one of its listed forms", () => {
    expect(ids("يضمن", "arabic")[0]).toBe("damina");
  });

  it("keeps an explicit sort order instead of reranking", () => {
    const hits = search("stone", {
      language: "english",
      limit: 20,
      sortBy: { property: "created_at_timestamp_ms", order: "DESC" },
    }).hits;
    const timestamps = hits.map(
      (hit) => hit.document.created_at_timestamp_ms ?? 0
    );
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("returns the same results page by page as in one request", () => {
    const pageSize = 10;
    const paged = Array.from({ length: 6 }, (_, page) =>
      search("stone", {
        language: "english",
        limit: pageSize,
        offset: page * pageSize,
      }).hits.map((hit) => hit.id)
    ).flat();

    expect(new Set(paged).size).toBe(paged.length);
    expect(paged).toEqual(ids("stone", "english", 60));
  });
});

describe("searchDictionary on a sparse dictionary", () => {
  it("searches when no entry fills some searched fields", async () => {
    const sparseDb = createDictionaryDatabase();
    await insertDocuments(sparseDb, [
      toOramaDocument({
        entry: entry({ id: "kitab", word: "كتاب", translation: "book" }),
      }),
    ]);

    for (const [term, language] of [
      ["كتاب", "arabic"],
      ["book", "english"],
    ] as const) {
      const results = searchDictionary(sparseDb, term, {
        language,
      }) as Results<InternalTypedDocument<DictionaryDocument>>;
      expect(results.hits.map((hit) => hit.id)).toEqual(["kitab"]);
    }
  });
});
