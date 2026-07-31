import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function disableFirebaseAppCheckDebugInProduction() {
  let transformed = false;
  return {
    name: "disable-firebase-app-check-debug-in-production",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.replaceAll("\\", "/");
      if (!normalizedId.endsWith("/@firebase/app-check/dist/esm/index.esm.js")) return null;

      const debugInitializer = /function initializeDebugMode\(\) \{[\s\S]*?\n\}\n\n\/\*\*/;
      if (!debugInitializer.test(code) || !code.includes("FIREBASE_APPCHECK_DEBUG_TOKEN")) {
        throw new Error("Firebase App Check debug bootstrap changed; refusing an unverifiable production build.");
      }

      transformed = true;
      return {
        code: code.replace(
          debugInitializer,
          `function initializeDebugMode() {
    const debugState = getDebugState();
    debugState.initialized = true;
}

/**`,
        ),
        map: null,
      };
    },
    buildEnd(error) {
      if (!error && !transformed) {
        throw new Error("Firebase App Check production hardening was not applied.");
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isProductionBuild = command === "build" && mode === "production";
  return {
    plugins: [
      react(),
      ...(isProductionBuild ? [disableFirebaseAppCheckDebugInProduction()] : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@app-check-debug": path.resolve(
          __dirname,
          isProductionBuild
            ? "./src/utils/appCheckDebug.production.js"
            : "./src/utils/appCheckDebug.js",
        ),
      },
    },
    build: {
      sourcemap: false,
    },
    server: { host: "0.0.0.0", port: 8080, strictPort: true },
  };
});
