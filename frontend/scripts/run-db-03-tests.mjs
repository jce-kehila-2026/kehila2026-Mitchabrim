import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const unit = spawnSync(process.execPath, [
  "--test",
  resolve(root, "tests", "db-03.unit.test.mjs"),
], { cwd: root, stdio: "inherit" });
if (unit.status !== 0) process.exit(unit.status ?? 1);

const workdir = resolve(tmpdir(), "mitchabrim-db03-emulator");
const configHome = resolve(tmpdir(), "mitchabrim-db03-firebase-config");
mkdirSync(workdir, { recursive: true });
mkdirSync(configHome, { recursive: true });
copyFileSync(resolve(root, "firestore.rules"), resolve(workdir, "firestore.rules"));
writeFileSync(resolve(workdir, "firebase.json"), JSON.stringify({
  firestore: { rules: "firestore.rules" },
  emulators: {
    firestore: { port: 8704 },
    ui: { enabled: false },
    singleProjectMode: true,
  },
}));

const bundledJava = process.env.USERPROFILE
  ? resolve(process.env.USERPROFILE, ".jdks", "openjdk-25")
  : null;
const javaHome = process.env.JAVA_HOME
  || (bundledJava && existsSync(resolve(bundledJava, "bin", "java.exe"))
    ? bundledJava
    : undefined);
const cli = resolve(root, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
const integration = spawnSync(process.execPath, [
  cli,
  "emulators:exec",
  "--project",
  "demo-db03",
  "--only",
  "firestore",
  `node ${JSON.stringify(resolve(root, "tests", "db-03.firebase.test.mjs"))}`,
], {
  cwd: workdir,
  stdio: "inherit",
  env: {
    ...process.env,
    XDG_CONFIG_HOME: configHome,
    FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true",
    ...(javaHome ? {
      JAVA_HOME: javaHome,
      PATH: `${resolve(javaHome, "bin")}${delimiter}${process.env.PATH || ""}`,
    } : {}),
  },
});
process.exit(integration.status ?? 1);

