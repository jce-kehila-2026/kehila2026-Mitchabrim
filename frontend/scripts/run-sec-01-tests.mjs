import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const projectRoot = resolve(import.meta.dirname, "..");
const localConfigHome = resolve(tmpdir(), "mitchabrim-sec01-firebase-config");
mkdirSync(localConfigHome, { recursive: true });
// The Firestore emulator's Java process cannot read this repository's Arabic
// parent path on some Windows setups. Run it from an ASCII-only temp folder
// with exact copies of the checked-in rules.
const emulatorWorkdir = resolve(tmpdir(), "mitchabrim-sec01-emulator");
mkdirSync(emulatorWorkdir, { recursive: true });
copyFileSync(resolve(projectRoot, "firestore.rules"), resolve(emulatorWorkdir, "firestore.rules"));
copyFileSync(resolve(projectRoot, "storage.rules"), resolve(emulatorWorkdir, "storage.rules"));
writeFileSync(
  resolve(emulatorWorkdir, "firebase.json"),
  JSON.stringify({
    firestore: { rules: "firestore.rules" },
    storage: { rules: "storage.rules" },
    emulators: {
      auth: { port: 9199 },
      firestore: { port: 8180 },
      storage: { port: 9299 },
      ui: { enabled: false },
      singleProjectMode: true,
    },
  }),
);

const bundledJava = process.env.USERPROFILE
  ? resolve(process.env.USERPROFILE, ".jdks", "openjdk-25")
  : null;
const javaHome = process.env.JAVA_HOME || (bundledJava && existsSync(resolve(bundledJava, "bin", "java.exe"))
  ? bundledJava
  : undefined);

const firebaseCli = resolve(
  projectRoot,
  "node_modules",
  "firebase-tools",
  "lib",
  "bin",
  "firebase.js",
);

const result = spawnSync(
  process.execPath,
  [
    firebaseCli,
    "emulators:exec",
    "--project",
    "demo-sec01",
    "--only",
    "auth,firestore,storage",
    `node ${JSON.stringify(resolve(projectRoot, "tests", "sec-01.rules.test.mjs"))}`,
  ],
  {
    cwd: emulatorWorkdir,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: localConfigHome,
      FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true",
      ...(javaHome ? { JAVA_HOME: javaHome } : {}),
      ...(javaHome ? { PATH: `${resolve(javaHome, "bin")};${process.env.PATH || ""}` } : {}),
    },
    encoding: "utf8",
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
