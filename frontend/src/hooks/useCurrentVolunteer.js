import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

/**
 * Loads the volunteer profile linked to the currently logged-in user
 * via volunteers.authUid == currentUser.uid.
 *
 * Returns: { volunteer, loading, error, linked }
 */
export default function useCurrentVolunteer() {
  const { user } = useAuth();
  const [volunteer, setVolunteer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.uid) {
        setVolunteer(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError("");
        const q = query(collection(db, "volunteers"), where("authUid", "==", user.uid));
        const snap = await getDocs(q);
        if (cancelled) return;
        if (snap.empty) {
          setVolunteer(null);
        } else {
          const d = snap.docs[0];
          setVolunteer({ id: d.id, ...d.data() });
        }
      } catch (err) {
        console.error("useCurrentVolunteer error:", err);
        if (!cancelled) setError(err.message || "שגיאה בטעינת פרופיל המתנדב");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  return { volunteer, loading, error, linked: !!volunteer };
}
