import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const unit = spawnSync(process.execPath, [
  "--test",
  resolve(root, "tests", "db-01.unit.test.mjs"),
], { cwd: root, stdio: "inherit" });
if (unit.status !== 0) process.exit(unit.status ?? 1);

const workdir = resolve(tmpdir(), "mitchabrim-db01-emulator");
const configHome = resolve(tmpdir(), "mitchabrim-db01-firebase-config");
mkdirSync(workdir, { recursive: true });
mkdirSync(configHome, { recursive: true });
copyFileSync(resolve(root, "firestore.rules"), resolve(workdir, "firestore.rules"));
writeFileSync(resolve(workdir, "firebase.json"), JSON.stringify({
  firestore: { rules: "firestore.rules" },
  emulators: {
    auth: { port: 9713 },
    firestore: { port: 8694 },
    ui: { enabled: false },
    singleProjectMode: true,
  },
}));

const jdksDirectory = process.env.USERPROFILE
  ? resolve(process.env.USERPROFILE, ".jdks")
  : null;
const bundledJava = jdksDirectory && existsSync(jdksDirectory)
  ? readdirSync(jdksDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^openjdk-(?:2[1-9]|[3-9]\d)(?:[.-]|$)/.test(entry.name))
    .map((entry) => resolve(jdksDirectory, entry.name))
    .find((candidate) => existsSync(resolve(candidate, "bin", "java.exe")))
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
  "demo-db01",
  "--only",
  "auth,firestore",
  `node ${JSON.stringify(resolve(root, "tests", "db-01.firebase.test.mjs"))}`,
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

