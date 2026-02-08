import { describe, expect, test } from "vitest";
import { diffMenuVersions } from "./menuVersioning";

describe("menuVersioning", () => {
  test("detects added/removed/changed ingredients and cost delta", () => {
    const diff = diffMenuVersions(
      {
        versionNumber: 1,
        name: "Menu base",
        items: [
          { productId: "rice", quantityPerPax: 0.2, costPrice: 2 },
          { productId: "fish", quantityPerPax: 0.3, costPrice: 10 },
        ],
      },
      {
        versionNumber: 2,
        name: "Menu base v2",
        items: [
          { productId: "rice", quantityPerPax: 0.25, costPrice: 2 },
          { productId: "tomato", quantityPerPax: 0.1, costPrice: 3 },
        ],
      },
    );

    expect(diff.added.map((i) => i.productId)).toContain("tomato");
    expect(diff.removed.map((i) => i.productId)).toContain("fish");
    expect(diff.changed[0].productId).toBe("rice");
  });
});
