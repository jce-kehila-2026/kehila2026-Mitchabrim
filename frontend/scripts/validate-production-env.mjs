import { resolve } from "node:path";
import { loadEnv } from "vite";
import { validateProductionEnv } from "./production-build-guards.mjs";

const root = resolve(import.meta.dirname, "..");
const fileEnv = loadEnv("production", root, "");
const env = { ...fileEnv, ...process.env };

validateProductionEnv(env);
console.log("Production Firebase configuration validated without printing values.");
