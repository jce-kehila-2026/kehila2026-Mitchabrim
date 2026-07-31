import { useSyncExternalStore } from "react";
import { subscribeSiteContent, DEFAULT_SITE_CONTENT } from "@/services/siteContentService";

let currentSnapshot = { content: DEFAULT_SITE_CONTENT, loading: true };
let firestoreUnsubscribe = null;
let teardownTimer = null;
const consumers = new Set();

function emit() {
  consumers.forEach((consumer) => consumer());
}

function startFirestoreSubscription() {
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  if (firestoreUnsubscribe) return;

  firestoreUnsubscribe = subscribeSiteContent((content) => {
    currentSnapshot = { content, loading: false };
    emit();
  });
}

function subscribe(consumer) {
  consumers.add(consumer);
  startFirestoreSubscription();

  return () => {
    consumers.delete(consumer);
    if (consumers.size !== 0) return;

    // Strict Mode immediately unsubscribes and resubscribes in development.
    // A one-task grace period reuses that listener but still tears it down
    // promptly after real navigation.
    teardownTimer = setTimeout(() => {
      if (consumers.size !== 0) return;
      firestoreUnsubscribe?.();
      firestoreUnsubscribe = null;
      teardownTimer = null;
      currentSnapshot = { content: DEFAULT_SITE_CONTENT, loading: true };
    }, 0);
  };
}

function getSnapshot() {
  return currentSnapshot;
}

export default function useSiteContent() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
