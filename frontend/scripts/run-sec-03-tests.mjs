import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const projectRoot = resolve(import.meta.dirname, "..");
const configHome = resolve(tmpdir(), "mitchabrim-sec03-firebase-config");
const workdir = resolve(tmpdir(), "mitchabrim-sec03-emulator");
mkdirSync(configHome, { recursive: true });
mkdirSync(workdir, { recursive: true });
copyFileSync(resolve(projectRoot, "firestore.rules"), resolve(workdir, "firestore.rules"));
copyFileSync(resolve(projectRoot, "storage.rules"), resolve(workdir, "storage.rules"));
writeFileSync(resolve(workdir, "firebase.json"), JSON.stringify({
  firestore: { rules: "firestore.rules" },
  storage: { rules: "storage.rules" },
  emulators: {
    auth: { port: 9199 },
    firestore: { port: 8180 },
    storage: { port: 9299 },
    ui: { enabled: false },
    singleProjectMode: true,
  },
}));

const bundledJdksRoot = process.env.USERPROFILE
  ? resolve(process.env.USERPROFILE, ".jdks")
  : null;
const bundledJava = bundledJdksRoot && existsSync(bundledJdksRoot)
  ? readdirSync(bundledJdksRoot)
    .filter((name) => /^openjdk-(?:2[1-9]|[3-9]\d)/.test(name))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    .map((name) => resolve(bundledJdksRoot, name))
    .find((candidate) => existsSync(resolve(candidate, "bin", "java.exe")))
  : null;
const javaHome = process.env.JAVA_HOME || (bundledJava && existsSync(resolve(bundledJava, "bin", "java.exe"))
  ? bundledJava
  : undefined);
const firebaseCli = resolve(projectRoot, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
const result = spawnSync(process.execPath, [
  firebaseCli,
  "emulators:exec",
  "--project",
  "demo-sec03",
  "--only",
  "auth,firestore,storage",
  `node ${JSON.stringify(resolve(projectRoot, "tests", "sec-03.rules.test.mjs"))}`,
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
