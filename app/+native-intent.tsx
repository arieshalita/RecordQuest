import { normalizeNativeIntentPath } from "../utils/native-intent";

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return normalizeNativeIntentPath(path);
}
