export type DataMode = "async-storage" | "supabase";

const configuredMode = process.env.EXPO_PUBLIC_RECORDQUEST_DATA_MODE;

export const RECORDQUEST_DATA_MODE: DataMode =
  configuredMode === "async-storage" ? "async-storage" : "supabase";

export function isSupabaseDataModeEnabled(): boolean {
  return RECORDQUEST_DATA_MODE === "supabase";
}
