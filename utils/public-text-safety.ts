const PUBLIC_PROFILE_BLOCKED_TERMS = [
  "fuck",
  "fucking",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "slut",
  "whore",
] as const;

function tokenizeLower(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function containsBlockedPublicTerm(input: string): boolean {
  const normalized = input.toLowerCase();
  const tokens = tokenizeLower(input);
  const blocked = new Set<string>(PUBLIC_PROFILE_BLOCKED_TERMS);

  for (const term of blocked) {
    if (normalized.includes(term)) {
      return true;
    }
  }

  return tokens.some((token) => blocked.has(token));
}

export function validatePublicProfileText(displayName: string, bio: string): string | null {
  if (containsBlockedPublicTerm(displayName)) {
    return "Display name contains disallowed language.";
  }

  if (containsBlockedPublicTerm(bio)) {
    return "Bio contains disallowed language.";
  }

  return null;
}
