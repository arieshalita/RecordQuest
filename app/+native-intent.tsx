import { describeNativeIntent, normalizeNativeIntentPath } from "../utils/native-intent";

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  const normalized = normalizeNativeIntentPath(path);

  if (__DEV__) {
    const details = describeNativeIntent(path);
    console.log("[RecordQuest][native-intent] deep link received", {
      appStartState: initial ? "cold-start" : "already-running",
      incomingScheme: details.incomingScheme,
      normalizedPathname: details.normalizedPathname,
      queryParamNames: details.queryParamNames,
      fragmentParamNames: details.fragmentParamNames,
    });
  }

  return normalized;
}
