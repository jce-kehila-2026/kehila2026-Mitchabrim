import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const projectRoot = resolve(import.meta.dirname, "..");
const configHome = resolve(tmpdir(), "mitchabrim-sec04-firebase-config");
const workdir = resolve(tmpdir(), "mitchabrim-sec04-emulator");
mkdirSync(configHome, { recursive: true });
mkdirSync(workdir, { recursive: true });
copyFileSync(resolve(projectRoot, "firestore.rules"), resolve(workdir, "firestore.rules"));
writeFileSync(resolve(workdir, "firebase.json"), JSON.stringify({
  firestore: { rules: "firestore.rules" },
  emulators: {
    auth: { port: 9399 },
    firestore: { port: 8380 },
    ui: { enabled: false },
    singleProjectMode: true,
  },
}));

const bundledJava = process.env.USERPROFILE ? resolve(process.env.USERPROFILE, ".jdks", "openjdk-25") : null;
const javaHome = process.env.JAVA_HOME || (bundledJava && existsSync(resolve(bundledJava, "bin", "java.exe"))
  ? bundledJava
  : undefined);
const firebaseCli = resolve(projectRoot, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
const result = spawnSync(process.execPath, [
  firebaseCli,
  "emulators:exec",
  "--project",
  "demo-sec04",
  "--only",
  "auth,firestore",
  `node ${JSON.stringify(resolve(projectRoot, "tests", "sec-04.rules.test.mjs"))}`,
], {
  cwd: workdir,
  env: {
    ...process.env,
    XDG_CONFIG_HOME: configHome,
    FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true",
    ...(javaHome ? { JAVA_HOME: javaHome, PATH: `${resolve(javaHome, "bin")};${process.env.PATH || ""}` } : {}),
  },
  encoding: "utf8",
  stdio: "inherit",
});
process.exit(result.status ?? 1);
