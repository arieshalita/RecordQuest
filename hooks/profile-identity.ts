import { supabase } from "./supabase-client";

export type PublicProfileIdentity = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
};

export type SaveProfileIdentityResult = {
  success: boolean;
  error?: string;
  profile?: PublicProfileIdentity;
};

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapRowToIdentity(row: Record<string, unknown>): PublicProfileIdentity | null {
  const userId = readString(row.user_id);
  if (!userId) return null;

  const username = readString(row.username);
  const displayName = readString(row.display_name) || username || "RecordQuest User";
  const avatarUrl = readString(row.avatar_url) || undefined;

  return {
    userId,
    username,
    displayName,
    avatarUrl,
  };
}

export function sanitizeUsername(input: string): string {
  const withoutAt = input.trim().replace(/^@+/, "").toLowerCase();
  return withoutAt.replace(/[^a-z0-9._]/g, "");
}

export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN_LENGTH) {
    return "Username must be at least 3 characters.";
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return "Username must be 24 characters or fewer.";
  }

  if (!/^[a-z0-9._]+$/.test(username)) {
    return "Username can only use letters, numbers, underscores, and periods.";
  }

  return null;
}

export async function getProfileIdentity(userId: string): Promise<PublicProfileIdentity | null> {
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,user_id,username,display_name,avatar_url")
    .eq("user_id", trimmedUserId)
    .maybeSingle();

  if (error || !data || typeof data !== "object") {
    return null;
  }

  return mapRowToIdentity(data as Record<string, unknown>);
}

export async function saveOwnProfileIdentity(
  userId: string,
  displayNameInput: string,
  usernameInput: string
): Promise<SaveProfileIdentityResult> {
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) {
    return {
      success: false,
      error: "You must be signed in to update your profile.",
    };
  }

  const sanitizedUsername = sanitizeUsername(usernameInput);
  const usernameError = validateUsername(sanitizedUsername);
  if (usernameError) {
    return {
      success: false,
      error: usernameError,
    };
  }

  const trimmedDisplayName = displayNameInput.trim();
  if (!trimmedDisplayName) {
    return {
      success: false,
      error: "Display name is required.",
    };
  }

  const existingProfile = await getProfileIdentity(trimmedUserId);

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: trimmedUserId,
        username: sanitizedUsername,
        display_name: trimmedDisplayName,
        avatar_url: existingProfile?.avatarUrl ?? null,
      },
      { onConflict: "user_id" }
    )
    .select("id,user_id,username,display_name,avatar_url")
    .single();

  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return {
        success: false,
        error: "That username is already taken. Try another one.",
      };
    }

    return {
      success: false,
      error: error.message,
    };
  }

  const profile = mapRowToIdentity((data ?? {}) as Record<string, unknown>);
  if (!profile) {
    return {
      success: false,
      error: "Profile updated, but response was invalid.",
    };
  }

  return {
    success: true,
    profile,
  };
}
