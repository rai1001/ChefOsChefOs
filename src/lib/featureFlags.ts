export const FEATURE_FLAG_KEYS = [
  "ai_purchase_suggestions",
  "ai_daily_briefing",
  "ai_menu_recommender",
  "ai_ops_alert_copy",
  "clawtbot_integration",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type HotelFeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: HotelFeatureFlags = {
  ai_purchase_suggestions: false,
  ai_daily_briefing: false,
  ai_menu_recommender: false,
  ai_ops_alert_copy: false,
  clawtbot_integration: false,
};

export interface FeatureFlagRow {
  feature_key: string;
  enabled: boolean;
}

export function normalizeFeatureFlags(
  rows: FeatureFlagRow[] | null | undefined,
): HotelFeatureFlags {
  const next: HotelFeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

  for (const row of rows ?? []) {
    if (FEATURE_FLAG_KEYS.includes(row.feature_key as FeatureFlagKey)) {
      next[row.feature_key as FeatureFlagKey] = Boolean(row.enabled);
    }
  }

  return next;
}

export function isFeatureEnabled(
  flags: HotelFeatureFlags | null | undefined,
  key: FeatureFlagKey,
): boolean {
  if (!flags) return DEFAULT_FEATURE_FLAGS[key];
  return Boolean(flags[key]);
}
