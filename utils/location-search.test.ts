import assert from "node:assert/strict";
import {
  buildLocationAutocompleteRequestBody,
  classifyLocationSearchInput,
  createAutocompleteSessionToken,
  fetchLocationPredictions,
  normalizeLocationSearchInput,
} from "./location-search";

async function runLocationSearchTests(): Promise<void> {
  assert.equal(normalizeLocationSearchInput("  Boston,   MA  "), "Boston, MA");
  assert.equal(classifyLocationSearchInput("Boston"), "city");
  assert.equal(classifyLocationSearchInput("02139"), "address");
  assert.equal(classifyLocationSearchInput("123 Main St"), "address");

  const token = createAutocompleteSessionToken();
  assert.ok(token.startsWith("rq-"), "session token should use the expected prefix");
  assert.ok(token.length <= 36, "session token should stay within the Google limit");

  const newYorkRequest = buildLocationAutocompleteRequestBody(" New York ", { sessionToken: token });
  assert.deepEqual(newYorkRequest, {
    input: "New York",
    sessionToken: token,
    includeQueryPredictions: false,
    languageCode: "en-US",
    regionCode: "us",
  });

  const zipRequest = buildLocationAutocompleteRequestBody("02108", { sessionToken: token });
  assert.deepEqual(zipRequest, {
    input: "02108",
    sessionToken: token,
    includeQueryPredictions: false,
    languageCode: "en-US",
    regionCode: "us",
  });

  const addressRequest = buildLocationAutocompleteRequestBody("  10 Main St, Boston, MA  ", { sessionToken: token });
  assert.deepEqual(addressRequest, {
    input: "10 Main St, Boston, MA",
    sessionToken: token,
    includeQueryPredictions: false,
    languageCode: "en-US",
    regionCode: "us",
  });

  const noBiasRequest = buildLocationAutocompleteRequestBody("Boston", { sessionToken: token });
  assert.ok(noBiasRequest);
  assert.equal("locationBias" in noBiasRequest!, false);
  assert.equal("locationRestriction" in noBiasRequest!, false);

  const validBiasRequest = buildLocationAutocompleteRequestBody("Boston", {
    sessionToken: token,
    locationBias: {
      center: { latitude: 42.3601, longitude: -71.0589 },
      radiusMeters: 16000,
    },
  });
  assert.deepEqual(validBiasRequest?.locationBias, {
    circle: {
      center: { latitude: 42.3601, longitude: -71.0589 },
      radius: 16000,
    },
  });

  const invalidBiasRequest = buildLocationAutocompleteRequestBody("Boston", {
    sessionToken: token,
    locationBias: {
      center: { latitude: Number.NaN, longitude: -71.0589 },
      radiusMeters: 16000,
    },
  });
  assert.equal("locationBias" in invalidBiasRequest!, false);

  const restrictionRequest = buildLocationAutocompleteRequestBody("Boston", {
    sessionToken: token,
    locationBias: {
      center: { latitude: 42.3601, longitude: -71.0589 },
      radiusMeters: 16000,
    },
    locationRestriction: {
      center: { latitude: 42.35, longitude: -71.07 },
      radiusMeters: 12000,
    },
  });
  assert.equal("locationBias" in restrictionRequest!, false);
  assert.deepEqual(restrictionRequest?.locationRestriction, {
    circle: {
      center: { latitude: 42.35, longitude: -71.07 },
      radius: 12000,
    },
  });

  assert.equal(buildLocationAutocompleteRequestBody("  ", { sessionToken: token }), null);

  const fetchCalls: Array<unknown> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: Array<unknown>) => {
    fetchCalls.push(args);
    throw new Error("fetch should not be called for blank input");
  }) as typeof fetch;

  try {
    const blankPredictions = await fetchLocationPredictions("   ", token);
    assert.deepEqual(blankPredictions, []);
    assert.equal(fetchCalls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("location-search tests passed");
}

runLocationSearchTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
