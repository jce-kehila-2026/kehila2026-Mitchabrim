import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; 
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { prepareAppCheckDebugMode } from "./utils/appCheckDebug";

const firebaseConfig = {
 apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
const useFirebaseEmulators = import.meta.env.DEV
  && import.meta.env.VITE_FIREBASE_USE_EMULATORS === "true";
const useAppCheckDebug = import.meta.env.DEV
  && import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG === "true";

let appCheckDebugSetupError = null;
if (useAppCheckDebug && typeof self !== "undefined") {
  const debugSetup = prepareAppCheckDebugMode(self);
  if (!debugSetup.ready) {
    appCheckDebugSetupError = debugSetup.reason;
  }
}

export const appCheck = appCheckSiteKey && typeof window !== "undefined" && !appCheckDebugSetupError
  ? initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
  : null;

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);
export const isJoinRequestAppCheckConfigured = Boolean(appCheckSiteKey);

let joinRequestFunctions = null;

export async function getJoinRequestFunctions() {
  if (appCheckDebugSetupError) {
    const error = new Error("This development origin cannot initialize App Check debug mode.");
    error.code = "join-request/app-check-debug-unsupported";
    throw error;
  }
  if (!appCheck) return null;

  // Do not instantiate Functions until App Check has completed one successful
  // exchange. This guarantees that the Functions context observes the App
  // Check provider registered on this exact Firebase app instance.
  try {
    await getToken(appCheck, false);
  } catch (cause) {
    const debugTokenRejected = useAppCheckDebug && [
      "appCheck/fetch-status-error",
      "appCheck/initial-throttle",
      "appCheck/throttled",
    ].includes(cause?.code);
    if (debugTokenRejected) {
      const error = new Error("The development browser's App Check debug token is not registered or accepted.");
      error.code = "join-request/app-check-debug-token-rejected";
      error.cause = cause;
      throw error;
    }
    throw cause;
  }

  if (!joinRequestFunctions) {
    joinRequestFunctions = getFunctions(app, "us-central1");
    if (useFirebaseEmulators) {
      connectFunctionsEmulator(joinRequestFunctions, "127.0.0.1", 5001);
    }
  }
  return joinRequestFunctions;
}

// Authenticated, App Check-protected callable Functions share the same regional
// client. The alias keeps existing join-request callers backward compatible.
export const getSecureFunctions = getJoinRequestFunctions;

export default app;
