import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadEnv } from "vite";
import { inspectProductionBundle, validateProductionEnv } from "./production-build-guards.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const fileEnv = loadEnv("production", root, "");
const env = { ...fileEnv, ...process.env };

validateProductionEnv(env);

const index = readFileSync(join(dist, "index.html"), "utf8");
if (!/<script[^>]+src="\/assets\/index-[^"]+\.js"/.test(index)) {
  throw new Error("dist/index.html does not reference the expected production entry asset.");
}

const assets = readdirSync(join(dist, "assets"))
  .filter((name) => name.endsWith(".js"))
  .map((name) => readFileSync(join(dist, "assets", name), "utf8"))
  .join("\n");

const result = inspectProductionBundle({
  javascript: assets,
  siteKey: env.VITE_FIREBASE_APPCHECK_SITE_KEY,
});

console.log(
  "Hosting artifact verified: App Check configured, debug bootstrap absent, current location operations present.",
);
