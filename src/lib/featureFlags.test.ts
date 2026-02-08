import { describe, expect, test } from "vitest";
import {
  DEFAULT_FEATURE_FLAGS,
  isFeatureEnabled,
  normalizeFeatureFlags,
} from "./featureFlags";

describe("featureFlags", () => {
  test("uses defaults when table is empty", () => {
    expect(normalizeFeatureFlags([])).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  test("reads and applies stored flags", () => {
    const flags = normalizeFeatureFlags([
      { feature_key: "ai_daily_briefing", enabled: true },
      { feature_key: "clawtbot_integration", enabled: true },
    ]);

    expect(flags.ai_daily_briefing).toBe(true);
    expect(flags.clawtbot_integration).toBe(true);
    expect(flags.ai_menu_recommender).toBe(false);
  });

  test("falls back to defaults for missing key", () => {
    expect(isFeatureEnabled(undefined, "ai_purchase_suggestions")).toBe(false);
  });
});
