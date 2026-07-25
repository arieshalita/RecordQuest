import { supabase } from "./supabase-client";
import type { User } from "@supabase/supabase-js";

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

export type EnsureOwnProfileFromAuthResult = {
  success: boolean;
  usernameSetupRequired: boolean;
  status: "ready" | "username-required" | "temporary-error" | "auth-invalid";
  error?: string;
  profile?: PublicProfileIdentity;
};

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;
export const USERNAME_PATTERN = /^[a-z0-9._]{3,24}$/;

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

function fallbackDisplayNameFromUser(user: User): string {
  const metadataDisplayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";

  if (metadataDisplayName) {
    return metadataDisplayName;
  }

  const metadataUsername =
    typeof user.user_metadata?.username === "string"
      ? sanitizeUsername(user.user_metadata.username)
      : "";

  if (metadataUsername) {
    return metadataUsername;
  }

  const emailLocal = typeof user.email === "string" ? user.email.split("@")[0]?.trim() : "";
  if (emailLocal) {
    return emailLocal;
  }

  return "RecordQuest User";
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
  if (!USERNAME_PATTERN.test(username)) {
    if (username.length < USERNAME_MIN_LENGTH) {
      return "Username must be at least 3 characters.";
    }

    if (username.length > USERNAME_MAX_LENGTH) {
      return "Username must be 24 characters or fewer.";
    }

    return "Username can only use lowercase letters, numbers, underscores, and periods.";
  }

  return null;
}

export async function ensureOwnProfileFromAuthMetadata(): Promise<EnsureOwnProfileFromAuthResult> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      success: false,
      usernameSetupRequired: false,
      status: "auth-invalid",
      error: "You must be signed in to continue.",
    };
  }

  const authUser = data.user;
  const authUserId = authUser.id.trim();

  const metadataUsernameRaw =
    typeof authUser.user_metadata?.username === "string"
      ? authUser.user_metadata.username
      : "";
  const metadataUsername = sanitizeUsername(metadataUsernameRaw);
  const metadataUsernameError = metadataUsername ? validateUsername(metadataUsername) : "Username is required.";
  const fallbackDisplayName = fallbackDisplayNameFromUser(authUser);

  const existingLookup = await supabase
    .from("profiles")
    .select("id,user_id,username,display_name,avatar_url,bio")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (existingLookup.error) {
    return {
      success: false,
      usernameSetupRequired: false,
      status: "temporary-error",
      error: "We couldn't load your profile right now. Please try again.",
    };
  }

  const existingProfile =
    existingLookup.data && typeof existingLookup.data === "object"
      ? mapRowToIdentity(existingLookup.data as Record<string, unknown>)
      : null;

  const existingUsernameError = existingProfile?.username ? validateUsername(existingProfile.username) : "missing";
  if (existingProfile?.username && !existingUsernameError) {
    return {
      success: true,
      usernameSetupRequired: false,
      status: "ready",
      profile: existingProfile,
    };
  }

  if (metadataUsernameError) {
    return {
      success: false,
      usernameSetupRequired: true,
      status: "username-required",
      error: "We couldn't finish setting up your username. Please choose a valid username and try again.",
      profile: existingProfile ?? undefined,
    };
  }

  const ensureRowResult = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: authUserId,
        display_name: existingProfile?.displayName || fallbackDisplayName,
        bio: existingProfile?.bio ?? "",
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: true,
      }
    );

  if (ensureRowResult.error) {
    return {
      success: false,
      usernameSetupRequired: false,
      status: "temporary-error",
      error: "We couldn't initialize your profile right now. Please try again.",
    };
  }

  const writeResult = await supabase
    .from("profiles")
    .update({
      username: metadataUsername,
    })
    .eq("user_id", authUserId)
    .or("username.is.null,username.eq.");

  if (writeResult.error) {
    if (writeResult.error.code === "23505" || /duplicate|unique/i.test(writeResult.error.message)) {
      return {
        success: false,
        usernameSetupRequired: true,
        status: "username-required",
        error: "That username is already taken. Please choose another one.",
        profile: existingProfile ?? undefined,
      };
    }

    return {
      success: false,
      usernameSetupRequired: false,
      status: "temporary-error",
      error: "We couldn't initialize your profile right now. Please try again.",
    };
  }

  const refreshedProfileResult = await supabase
    .from("profiles")
    .select("id,user_id,username,display_name,avatar_url,bio")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (refreshedProfileResult.error) {
    return {
      success: false,
      usernameSetupRequired: false,
      status: "temporary-error",
      error: "We couldn't initialize your profile right now. Please try again.",
    };
  }

  const profile =
    refreshedProfileResult.data && typeof refreshedProfileResult.data === "object"
      ? mapRowToIdentity(refreshedProfileResult.data as Record<string, unknown>) ?? undefined
      : undefined;

  if (!profile?.username) {
    return {
      success: false,
      usernameSetupRequired: true,
      status: "username-required",
      error: "We couldn't finish setting up your username. Please try a different username.",
      profile,
    };
  }

  return {
    success: true,
    usernameSetupRequired: false,
    status: "ready",
    profile,
  };
}

export async function completeOwnUsername(usernameInput: string): Promise<SaveProfileIdentityResult> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      success: false,
      error: "You must be signed in to update your username.",
    };
  }

  const authUser = data.user;
  const authUserId = authUser.id.trim();
  const normalizedUsername = sanitizeUsername(usernameInput);
  const usernameError = validateUsername(normalizedUsername);

  if (usernameError) {
    return {
      success: false,
      error: usernameError,
    };
  }

  const fallbackDisplayName = fallbackDisplayNameFromUser(authUser);

  const existingLookup = await supabase
    .from("profiles")
    .select("id,user_id,username,display_name,avatar_url,bio")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (existingLookup.error) {
    return genericProfileSaveError();
  }

  const existingProfile =
    existingLookup.data && typeof existingLookup.data === "object"
      ? mapRowToIdentity(existingLookup.data as Record<string, unknown>)
      : null;

  if (existingProfile?.username && !validateUsername(existingProfile.username)) {
    return {
      success: true,
      profile: existingProfile,
    };
  }

  const ensureRowResult = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: authUserId,
        display_name: existingProfile?.displayName || fallbackDisplayName,
        bio: existingProfile?.bio ?? "",
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: true,
      }
    );

  if (ensureRowResult.error) {
    return {
      success: false,
      error: "Could not update your username right now. Please try again.",
    };
  }

  const writeResult = await supabase
    .from("profiles")
    .update({
      username: normalizedUsername,
    })
    .eq("user_id", authUserId)
    .or("username.is.null,username.eq.");

  if (writeResult.error) {
    if (writeResult.error.code === "23505" || /duplicate|unique/i.test(writeResult.error.message)) {
      return {
        success: false,
        error: "That username is already taken. Please choose another.",
      };
    }

    return {
      success: false,
      error: "Could not update your username right now. Please try again.",
    };
  }

  const refreshedProfileResult = await supabase
    .from("profiles")
    .select("id,user_id,username,display_name,avatar_url,bio")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (refreshedProfileResult.error) {
    return {
      success: false,
      error: "Could not confirm your username right now. Please try again.",
    };
  }

  const profile =
    refreshedProfileResult.data && typeof refreshedProfileResult.data === "object"
      ? mapRowToIdentity(refreshedProfileResult.data as Record<string, unknown>)
      : null;

  if (!profile) {
    return {
      success: false,
      error: "Could not confirm your username right now. Please try again.",
    };
  }

  if (!profile.username || validateUsername(profile.username)) {
    return {
      success: false,
      error: "Could not finish setting your username. Please try again.",
    };
  }

  return {
    success: true,
    profile,
  };
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
