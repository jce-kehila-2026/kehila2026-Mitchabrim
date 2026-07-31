const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export function createOperationId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

export function requireOperationId(value) {
  const operationId = String(value || "").trim();
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    const error = new Error("A valid operation ID is required");
    error.code = "db01/invalid-operation-id";
    throw error;
  }
  return operationId;
}
