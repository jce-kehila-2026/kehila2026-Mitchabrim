export function createSubmissionGuard() {
  let acquired = false;

  return {
    tryAcquire() {
      if (acquired) return false;
      acquired = true;
      return true;
    },
  };
}
