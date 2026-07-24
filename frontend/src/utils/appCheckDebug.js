function uuidV4FromBytes(bytes) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export function createAppCheckDebugUuid(cryptoApi) {
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("A cryptographically secure random source is unavailable.");
  }
  return uuidV4FromBytes(cryptoApi.getRandomValues(new Uint8Array(16)));
}

export function prepareAppCheckDebugMode(target) {
  const cryptoApi = target?.crypto;
  if (!target || !cryptoApi) {
    return { ready: false, reason: "crypto-unavailable" };
  }

  let strategy = "native";
  if (typeof cryptoApi.randomUUID !== "function") {
    const randomUuid = () => createAppCheckDebugUuid(cryptoApi);
    try {
      Object.defineProperty(cryptoApi, "randomUUID", {
        configurable: true,
        value: randomUuid,
      });
    } catch {
      try {
        cryptoApi.randomUUID = randomUuid;
      } catch {
        return { ready: false, reason: "random-uuid-unavailable" };
      }
    }
    strategy = "polyfilled";
  }

  if (typeof cryptoApi.randomUUID !== "function") {
    return { ready: false, reason: "random-uuid-unavailable" };
  }

  // The SDK persists one generated token per browser origin in IndexedDB.
  // Supplying `true` keeps Firebase's documented debug-provider workflow and
  // avoids ever placing a debug credential in source code or Vite variables.
  target.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  return { ready: true, strategy };
}
