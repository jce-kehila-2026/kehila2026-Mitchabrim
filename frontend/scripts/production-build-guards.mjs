const REQUIRED_FIREBASE_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_APPCHECK_SITE_KEY",
];

const LOCATION_MARKERS = [
  "updateLocationSettings",
  "renameArea",
  "renameNeighborhood",
  "moveNeighborhood",
  "deleteArea",
  "deleteNeighborhood",
  "location-settings/app-check-required",
];

const APP_DEBUG_ACTIVATION_MARKERS = [
  "This development origin cannot initialize App Check debug mode.",
  "The development browser's App Check debug token is not registered or accepted.",
];

function isMissingOrPlaceholder(value) {
  const normalized = String(value || "").trim();
  return !normalized
    || /^<[^>]+>$/.test(normalized)
    || /^(change-me|placeholder|todo)$/i.test(normalized);
}

export function validateProductionEnv(env) {
  const missing = REQUIRED_FIREBASE_KEYS.filter((key) => isMissingOrPlaceholder(env[key]));
  if (missing.length > 0) {
    throw new Error(
      `Production build configuration is incomplete. Missing required variables: ${missing.join(", ")}. Values were not printed.`,
    );
  }
  if (env.VITE_FIREBASE_PROJECT_ID !== "mitchabrim-jce2026") {
    throw new Error("Production build targets an unexpected Firebase project. No value was printed.");
  }
  if (String(env.VITE_FIREBASE_APPCHECK_DEBUG || "").trim().toLowerCase() === "true") {
    throw new Error(
      "VITE_FIREBASE_APPCHECK_DEBUG must not be true in production mode. Put the development override in .env.development.local.",
    );
  }
}

export function inspectProductionBundle({ javascript, siteKey }) {
  if (isMissingOrPlaceholder(siteKey)) {
    throw new Error("Cannot verify the hosting artifact without the configured App Check site key.");
  }
  if (!javascript.includes(siteKey)) {
    throw new Error("The production bundle does not contain the configured App Check provider key.");
  }
  for (const marker of APP_DEBUG_ACTIVATION_MARKERS) {
    if (javascript.includes(marker)) {
      throw new Error("The production bundle contains application debug-mode code.");
    }
  }
  if (javascript.includes("FIREBASE_APPCHECK_DEBUG_TOKEN")) {
    throw new Error("The production bundle contains the Firebase App Check debug-token bootstrap.");
  }
  for (const marker of LOCATION_MARKERS) {
    if (!javascript.includes(marker)) {
      throw new Error(`The production bundle is missing the current location operation marker: ${marker}`);
    }
  }
  if (!javascript.includes("exchangeRecaptchaEnterpriseToken")) {
    throw new Error("The production bundle does not contain the reCAPTCHA Enterprise App Check exchange path.");
  }
  return {
    appCheckConfigured: true,
    debugModeActivated: false,
    locationOperationsPresent: true,
  };
}

export { APP_DEBUG_ACTIVATION_MARKERS, LOCATION_MARKERS, REQUIRED_FIREBASE_KEYS };
