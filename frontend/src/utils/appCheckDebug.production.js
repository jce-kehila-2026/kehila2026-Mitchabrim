// Production builds deliberately exclude the development debug-token workflow.
// Vite aliases @app-check-debug to this module only for production builds.
export const APP_CHECK_DEBUG_BUILD = false;

export function prepareAppCheckDebugMode() {
  return { ready: false, reason: "disabled-in-production" };
}
