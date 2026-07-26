import assert from "node:assert/strict";
import {
  buildStoreDedupFallbackKey,
  scoreGoogleStoreRelevance,
} from "./store-relevance";

function runStoreRelevanceTests(): void {
  const clearVinylStore = scoreGoogleStoreRelevance({
    name: "Blue Note Records & Vinyl",
    address: "10 Main St, Boston, MA",
    types: ["record_store", "store"],
    businessStatus: "OPERATIONAL",
    matchedQueries: ["record store"],
  });
  assert.equal(clearVinylStore.include, true, "clear vinyl record store should be included");

  const abstractBrandStore = scoreGoogleStoreRelevance({
    name: "Stereo Jack's",
    address: "744 Broadway, Somerville, MA",
    types: ["record_store", "store"],
    businessStatus: "OPERATIONAL",
    matchedQueries: ["vinyl record store"],
  });
  assert.equal(abstractBrandStore.include, true, "abstract brand record store should be included");

  const bookstoreWithRecords = scoreGoogleStoreRelevance({
    name: "Harbor Books & Vinyl",
    address: "1 Beacon St, Boston, MA",
    types: ["book_store", "store"],
    businessStatus: "OPERATIONAL",
    matchedQueries: ["used record store"],
  });
  assert.equal(bookstoreWithRecords.include, true, "bookstore with vinyl signals should be included");

  const instrumentStore = scoreGoogleStoreRelevance({
    name: "Needham Music Center",
    address: "2 Great Plain Ave, Needham, MA",
    types: ["musical_instrument_store", "store"],
    businessStatus: "OPERATIONAL",
    matchedQueries: ["record store"],
  });
  assert.equal(instrumentStore.include, false, "musical instrument-only store should be excluded");

  const recordingStudio = scoreGoogleStoreRelevance({
    name: "Downtown Recording Studio",
    address: "22 River St, Cambridge, MA",
    types: ["recording_studio"],
    businessStatus: "OPERATIONAL",
    matchedQueries: ["vinyl record store"],
  });
  assert.equal(recordingStudio.include, false, "recording studio should be excluded");

  const liveMusicVenue = scoreGoogleStoreRelevance({
    name: "The Vinyl Room",
    address: "9 Music Row, Boston, MA",
    types: ["live_music_venue", "bar"],
    businessStatus: "OPERATIONAL",
    matchedQueries: ["record store"],
  });
  assert.equal(liveMusicVenue.include, false, "live music venue should be excluded");

  const duplicateKeyA = buildStoreDedupFallbackKey("Blue Note Records", "10 Main St, Boston, MA");
  const duplicateKeyB = buildStoreDedupFallbackKey("blue note records ", "10 Main St Boston MA");
  assert.equal(duplicateKeyA, duplicateKeyB, "normalized dedupe key should collapse duplicate search results");

  const curatedWithoutKeywords = scoreGoogleStoreRelevance({
    name: "Stereo Jack's",
    address: "744 Broadway, Somerville, MA",
    types: ["store"],
    businessStatus: "OPERATIONAL",
    matchedQueries: ["record store"],
    isCuratedMatch: true,
  });
  assert.equal(curatedWithoutKeywords.include, true, "curated matching store should be protected");

  console.log("store-relevance tests passed");
}

runStoreRelevanceTests();
