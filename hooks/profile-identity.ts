import { supabase } from "./supabase-client";

export type PublicProfileIdentity = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
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
  const bio = readString(row.bio) || undefined;

  return {
    userId,
    username,
    displayName,
    avatarUrl,
    bio,
  };
}

function genericProfileSaveError(): SaveProfileIdentityResult {
  return {
    success: false,
    error: "We couldn't save your profile. Please try again.",
  };
}

function logProfileSaveFailure(context: {
  stage: "lookup" | "write";
  operation: "update" | "insert";
  authUid: string;
  targetUserId: string;
  rowExists: boolean;
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
}): void {
  if (!__DEV__) {
    return;
  }

  console.warn("[RecordQuest][profile][save] failed", {
    stage: context.stage,
    operation: context.operation,
    authUid: context.authUid,
    targetUserId: context.targetUserId,
    ownershipColumn: "user_id",
    rowExists: context.rowExists,
    errorCode: context.code,
    errorMessage: context.message,
    errorDetails: context.details,
    errorHint: context.hint,
  });
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.warn("[RecordQuest][profile] auth user lookup failed:", error.message);
    return null;
  }

  return data.user?.id?.trim() || null;
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
    .select("id,user_id,username,display_name,avatar_url,bio")
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
  usernameInput: string,
  bioInput = ""
): Promise<SaveProfileIdentityResult> {
  const authUserId = await getAuthenticatedUserId();
  if (!authUserId) {
    return {
      success: false,
      error: "You must be signed in to update your profile.",
    };
  }

  const trimmedUserId = userId.trim();
  if (trimmedUserId && trimmedUserId !== authUserId) {
    console.warn("[RecordQuest][profile] attempted save with mismatched user id", {
      suppliedUserId: trimmedUserId,
      authUserId,
    });
    return genericProfileSaveError();
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

  const trimmedBio = bioInput.trim();

  const existingLookup = await supabase
    .from("profiles")
    .select("id,user_id,username,display_name,avatar_url,bio")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (existingLookup.error) {
    logProfileSaveFailure({
      stage: "lookup",
      operation: "update",
      authUid: authUserId,
      targetUserId: authUserId,
      rowExists: false,
      code: existingLookup.error.code,
      message: existingLookup.error.message,
      details: existingLookup.error.details,
      hint: existingLookup.error.hint,
    });

    return genericProfileSaveError();
  }

  const existingProfile =
    existingLookup.data && typeof existingLookup.data === "object"
      ? mapRowToIdentity(existingLookup.data as Record<string, unknown>)
      : null;

  const writeResult = existingProfile
    ? await supabase
        .from("profiles")
        .update({
          username: sanitizedUsername,
          display_name: trimmedDisplayName,
          bio: trimmedBio,
        })
        .eq("user_id", authUserId)
        .select("id,user_id,username,display_name,avatar_url,bio")
        .single()
    : await supabase
        .from("profiles")
        .insert({
          user_id: authUserId,
          username: sanitizedUsername,
          display_name: trimmedDisplayName,
          bio: trimmedBio,
        })
        .select("id,user_id,username,display_name,avatar_url,bio")
        .single();

  const { data, error } = writeResult;

  if (error) {
    logProfileSaveFailure({
      stage: "write",
      operation: existingProfile ? "update" : "insert",
      authUid: authUserId,
      targetUserId: authUserId,
      rowExists: Boolean(existingProfile),
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return {
        success: false,
        error: "That username is already taken. Try another one.",
      };
    }

    return genericProfileSaveError();
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
