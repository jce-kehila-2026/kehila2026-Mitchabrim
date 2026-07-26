import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const workdir = resolve(tmpdir(), "mitchabrim-sec06-emulator");
const configHome = resolve(tmpdir(), "mitchabrim-sec06-firebase-config");
mkdirSync(workdir, { recursive: true }); mkdirSync(configHome, { recursive: true });
copyFileSync(resolve(root, "firestore.rules"), resolve(workdir, "firestore.rules"));
writeFileSync(resolve(workdir, "firebase.json"), JSON.stringify({
  firestore: { rules: "firestore.rules" },
  emulators: { firestore: { port: 8480 }, ui: { enabled: false }, singleProjectMode: true },
}));
const bundledJava = process.env.USERPROFILE ? resolve(process.env.USERPROFILE, ".jdks", "openjdk-25") : null;
const javaHome = process.env.JAVA_HOME || (bundledJava && existsSync(resolve(bundledJava, "bin", "java.exe")) ? bundledJava : undefined);
const cli = resolve(root, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
const result = spawnSync(process.execPath, [cli, "emulators:exec", "--project", "demo-sec06", "--only", "firestore", `node ${JSON.stringify(resolve(root, "tests", "sec-06.test.mjs"))}`], {
  cwd: workdir, stdio: "inherit", encoding: "utf8",
  env: { ...process.env, XDG_CONFIG_HOME: configHome, FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true", ...(javaHome ? { JAVA_HOME: javaHome, PATH: `${resolve(javaHome, "bin")};${process.env.PATH || ""}` } : {}) },
});
process.exit(result.status ?? 1);
