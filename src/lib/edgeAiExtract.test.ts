import { describe, expect, test } from "vitest";
import {
  extractFirstJsonObject,
  extractGeminiTextFromGenerateContent,
} from "../../supabase/functions/_shared/edgeAiExtract";

describe("edgeAiExtract", () => {
  test("extracts text from Gemini generateContent response", () => {
    const resp = {
      candidates: [
        {
          content: {
            parts: [{ text: "hola" }, { text: " mundo" }],
          },
        },
      ],
    };

    expect(extractGeminiTextFromGenerateContent(resp)).toBe("hola mundo");
  });

  test("extracts first JSON object from text (with markdown fences)", () => {
    const content = "```json\n{ \"a\": 1 }\n```";
    expect(extractFirstJsonObject(content)).toEqual({ a: 1 });
  });
});

