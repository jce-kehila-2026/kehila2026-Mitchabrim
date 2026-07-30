import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  inspectProductionBundle,
  validateProductionEnv,
} from "../scripts/production-build-guards.mjs";

const root = resolve(import.meta.dirname, "..");
const validEnv = {
  VITE_FIREBASE_API_KEY: "api",
  VITE_FIREBASE_AUTH_DOMAIN: "example.test",
  VITE_FIREBASE_PROJECT_ID: "mitchabrim-jce2026",
  VITE_FIREBASE_STORAGE_BUCKET: "bucket",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "sender",
  VITE_FIREBASE_APP_ID: "app",
  VITE_FIREBASE_APPCHECK_SITE_KEY: "site-key-for-test",
  VITE_FIREBASE_APPCHECK_DEBUG: "false",
};

test("production environment guard rejects missing App Check and debug mode", () => {
  assert.throws(
    () => validateProductionEnv({ ...validEnv, VITE_FIREBASE_APPCHECK_SITE_KEY: "" }),
    /VITE_FIREBASE_APPCHECK_SITE_KEY/,
  );
  assert.throws(
    () => validateProductionEnv({ ...validEnv, VITE_FIREBASE_APPCHECK_DEBUG: "true" }),
    /must not be true in production/,
  );
  assert.doesNotThrow(() => validateProductionEnv(validEnv));
});

test("production artifact guard requires provider configuration and current location code", () => {
  const currentCode = [
    "site-key-for-test",
    "exchangeRecaptchaEnterpriseToken",
    "updateLocationSettings",
    "renameArea",
    "renameNeighborhood",
    "moveNeighborhood",
    "deleteArea",
    "deleteNeighborhood",
    "location-settings/app-check-required",
  ].join(" ");
  const result = inspectProductionBundle({
    javascript: currentCode,
    siteKey: "site-key-for-test",
  });
  assert.equal(result.appCheckConfigured, true);
  assert.equal(result.debugModeActivated, false);
  assert.equal(result.locationOperationsPresent, true);
  assert.throws(
    () => inspectProductionBundle({
      javascript: `${currentCode} FIREBASE_APPCHECK_DEBUG_TOKEN=true`,
      siteKey: "site-key-for-test",
    }),
    /debug-token bootstrap/,
  );
});

test("hosting deploy rebuilds production and production source excludes application debug module", () => {
  const firebaseConfig = JSON.parse(readFileSync(resolve(root, "firebase.json"), "utf8"));
  const packageConfig = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const viteSource = readFileSync(resolve(root, "vite.config.js"), "utf8");
  const firebaseSource = readFileSync(resolve(root, "src/firebase.js"), "utf8");
  const productionDebugSource = readFileSync(
    resolve(root, "src/utils/appCheckDebug.production.js"),
    "utf8",
  );
  const envExample = readFileSync(resolve(root, ".env.example"), "utf8");

  assert.deepEqual(firebaseConfig.hosting.predeploy, ["npm run build:production"]);
  assert.match(packageConfig.scripts["build:production"], /validate-production-env[\s\S]*vite build --mode production[\s\S]*verify-hosting-artifact/);
  assert.match(viteSource, /appCheckDebug\.production\.js/);
  assert.match(viteSource, /disableFirebaseAppCheckDebugInProduction/);
  assert.match(viteSource, /Firebase App Check production hardening was not applied/);
  assert.match(firebaseSource, /APP_CHECK_DEBUG_BUILD[\s\S]*import\.meta\.env\.DEV/);
  assert.match(firebaseSource, /app-check\/config-missing/);
  assert.doesNotMatch(productionDebugSource, /FIREBASE_APPCHECK_DEBUG_TOKEN/);
  assert.match(envExample, /VITE_FIREBASE_APPCHECK_DEBUG=false/);
});
