const GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const GOOGLE_PLACES_GET_BASE_URL = "https://places.googleapis.com/v1";
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
const GOOGLE_REGION_CODE = "us";
const GOOGLE_AUTOCOMPLETE_LANGUAGE_CODE = "en-US";

type LocationPredictionPayload = {
  placePrediction?: {
    place?: string;
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    types?: string[];
  };
};

type LocationAutocompleteResponse = {
  suggestions?: LocationPredictionPayload[];
};

type GoogleErrorFieldViolation = {
  field?: string;
  description?: string;
};

type GoogleErrorDetail = {
  reason?: string;
  message?: string;
  fieldViolations?: GoogleErrorFieldViolation[];
};

type GoogleApiErrorResponse = {
  error?: {
    status?: string;
    message?: string;
    details?: GoogleErrorDetail[];
  };
};

type GooglePlaceDetailsResponse = {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
};

type LocationPoint = {
  latitude: number;
  longitude: number;
};

type LocationCircle = {
  center: LocationPoint;
  radiusMeters: number;
};

type LocationAutocompleteRequestOptions = {
  sessionToken: string;
  locationBias?: LocationCircle | null;
  locationRestriction?: LocationCircle | null;
};

export type LocationPrediction = {
  placeId: string;
  placeResourceName: string;
  primaryText: string;
  secondaryText?: string;
  types: string[];
};

export type ResolvedLocationResult = {
  placeId: string;
  latitude: number;
  longitude: number;
  label: string;
  formattedAddress: string;
};

type LocationSearchMode = "city" | "address";

type LocationPredictionResult = LocationPrediction | null;
type LocationAutocompleteRequestBody = {
  input: string;
  sessionToken: string;
  includeQueryPredictions: boolean;
  languageCode: string;
  regionCode: string;
  locationBias?: { circle: { center: LocationPoint; radius: number } };
  locationRestriction?: { circle: { center: LocationPoint; radius: number } };
};

const resolvedLocationCache = new Map<string, ResolvedLocationResult>();

export function createAutocompleteSessionToken(): string {
  return `rq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeLocationSearchInput(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeLocationCircle(value?: LocationCircle | null): { circle: { center: LocationPoint; radius: number } } | null {
  if (!value) {
    return null;
  }

  const { center, radiusMeters } = value;
  if (!center || !isFiniteNumber(center.latitude) || !isFiniteNumber(center.longitude) || !isFiniteNumber(radiusMeters) || radiusMeters <= 0) {
    return null;
  }

  return {
    circle: {
      center: {
        latitude: center.latitude,
        longitude: center.longitude,
      },
      radius: radiusMeters,
    },
  };
}

export function buildLocationAutocompleteRequestBody(
  input: string,
  options: LocationAutocompleteRequestOptions
): LocationAutocompleteRequestBody | null {
  const normalizedInput = normalizeLocationSearchInput(input);
  if (normalizedInput.length < 3) {
    return null;
  }

  const sessionToken = normalizeLocationSearchInput(options.sessionToken);
  if (!sessionToken) {
    throw new Error("Autocomplete session token is required.");
  }

  const body: LocationAutocompleteRequestBody = {
    input: normalizedInput,
    sessionToken,
    includeQueryPredictions: false,
    languageCode: GOOGLE_AUTOCOMPLETE_LANGUAGE_CODE,
    regionCode: GOOGLE_REGION_CODE,
  };

  const locationRestriction = normalizeLocationCircle(options.locationRestriction);
  if (locationRestriction) {
    body.locationRestriction = locationRestriction;
    return body;
  }

  const locationBias = normalizeLocationCircle(options.locationBias);
  if (locationBias) {
    body.locationBias = locationBias;
  }

  return body;
}

function extractGoogleFieldViolations(details?: GoogleErrorDetail[]): string[] {
  return (details ?? []).flatMap((detail) => {
    const violations = detail.fieldViolations ?? [];
    return violations.map((violation) => {
      const field = violation.field?.trim() || "unknown field";
      const description = violation.description?.trim() || detail.message?.trim() || detail.reason?.trim() || "invalid value";
      return `${field}: ${description}`;
    });
  });
}

function formatGoogleAutocompleteError(responseStatus: number, rawBody: string): string {
  let parsedBody: GoogleApiErrorResponse | null = null;

  try {
    parsedBody = JSON.parse(rawBody) as GoogleApiErrorResponse;
  } catch {
    parsedBody = null;
  }

  const googleError = parsedBody?.error;
  const status = googleError?.status?.trim() || `HTTP ${responseStatus}`;
  const message = googleError?.message?.trim() || rawBody.trim() || "Unknown Google Places error";
  const fieldViolations = extractGoogleFieldViolations(googleError?.details);

  return [
    `Autocomplete failed: ${status} — ${message}`,
    fieldViolations.length > 0 ? `Field violations: ${fieldViolations.join("; ")}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" | ");
}

async function throwIfAutocompleteFailed(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const rawBody = await response.text();
  const errorMessage = formatGoogleAutocompleteError(response.status, rawBody);
  const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;

  if (isDevelopment) {
    console.warn("[RecordQuest][stores] Google Places autocomplete error", errorMessage);
  }

  throw new Error(errorMessage);
}

export function classifyLocationSearchInput(value: string): LocationSearchMode {
  const normalized = normalizeLocationSearchInput(value).toLowerCase();

  if (/\d/.test(normalized) || normalized.includes(",") || normalized.includes("\n")) {
    return "address";
  }

  if (/\b(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|way|zip|zipcode|postal)\b/.test(normalized)) {
    return "address";
  }

  return "city";
}

function getPredictionText(payload: LocationPredictionPayload): { primaryText: string; secondaryText?: string } {
  const placePrediction = payload.placePrediction;
  if (!placePrediction) {
    return { primaryText: "" };
  }

  const primaryText =
    placePrediction.structuredFormat?.mainText?.text?.trim() ||
    placePrediction.text?.text?.trim() ||
    "";
  const secondaryText = placePrediction.structuredFormat?.secondaryText?.text?.trim() || undefined;

  return {
    primaryText,
    secondaryText,
  };
}

export async function fetchLocationPredictions(
  input: string,
  sessionToken: string
): Promise<LocationPrediction[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    return [];
  }

  const requestBody = buildLocationAutocompleteRequestBody(input, {
    sessionToken,
  });

  if (!requestBody) {
    return [];
  }

  const response = await fetch(GOOGLE_PLACES_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  await throwIfAutocompleteFailed(response);

  const payload = (await response.json()) as LocationAutocompleteResponse;
  const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];

  return suggestions
    .map<LocationPredictionResult>((suggestion) => {
      const placePrediction = suggestion.placePrediction;
      if (!placePrediction) {
        return null;
      }

      const placeId = placePrediction.placeId?.trim() ?? "";
      const placeResourceName = placePrediction.place?.trim() || (placeId ? `places/${placeId}` : "");
      const { primaryText, secondaryText } = getPredictionText(suggestion);

      if (!placeId || !placeResourceName || !primaryText) {
        return null;
      }

      return {
        placeId,
        placeResourceName,
        primaryText,
        secondaryText,
        types: placePrediction.types ?? [],
      } satisfies LocationPrediction;
    })
    .filter((prediction): prediction is LocationPrediction => prediction !== null);
}

export async function resolveLocationPrediction(
  prediction: LocationPrediction,
  sessionToken: string
): Promise<ResolvedLocationResult> {
  const cached = resolvedLocationCache.get(prediction.placeId);
  if (cached) {
    return cached;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Location resolution is unavailable.");
  }

  const detailsUrl = new URL(`${GOOGLE_PLACES_GET_BASE_URL}/${prediction.placeResourceName}`);
  detailsUrl.searchParams.set("sessionToken", sessionToken);
  detailsUrl.searchParams.set("languageCode", "en-US");
  detailsUrl.searchParams.set("regionCode", GOOGLE_REGION_CODE);

  const response = await fetch(detailsUrl.toString(), {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "displayName,formattedAddress,location",
    },
  });

  if (!response.ok) {
    throw new Error(`Place details lookup failed with status ${response.status}`);
  }

  const details = (await response.json()) as GooglePlaceDetailsResponse;
  const latitude = details.location?.latitude;
  const longitude = details.location?.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("Selected location does not have coordinates.");
  }

  const formattedAddress = details.formattedAddress?.trim() || "";
  const label = details.displayName?.text?.trim() || prediction.primaryText || formattedAddress || "Selected location";
  const resolved = {
    placeId: prediction.placeId,
    latitude,
    longitude,
    label,
    formattedAddress: formattedAddress || label,
  } satisfies ResolvedLocationResult;

  resolvedLocationCache.set(prediction.placeId, resolved);
  return resolved;
}
