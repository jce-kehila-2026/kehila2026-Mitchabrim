import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

/**
 * Loads the volunteer profile linked to the currently logged-in user.
 *
 * Primary path: users/{uid}.linkedVolunteerId -> volunteers/{linkedVolunteerId}
 * Fallback: volunteers where authUid == currentUser.uid
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

        console.log("current uid:", user.uid);

        // 1. Read users/{uid}
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : null;
        console.log("user doc:", userData);

        const linkedVolunteerId = userData?.linkedVolunteerId;
        console.log("linkedVolunteerId:", linkedVolunteerId);

        // 2. Primary: use linkedVolunteerId
        if (linkedVolunteerId) {
          const volRef = doc(db, "volunteers", linkedVolunteerId);
          const volSnap = await getDoc(volRef);
          if (!volSnap.exists()) {
            console.warn("Volunteer doc not found for linkedVolunteerId:", linkedVolunteerId);
            if (!cancelled) {
              setVolunteer(null);
              setError("פרופיל המתנדב המקושר לא נמצא במערכת.");
            }
            return;
          }
          const volunteerData = { id: volSnap.id, ...volSnap.data() };
          console.log("volunteer doc:", volunteerData);
          if (!cancelled) setVolunteer(volunteerData);
          return;
        }

        // 3. Fallback: search volunteers by authUid
        const q = query(collection(db, "volunteers"), where("authUid", "==", user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          const volunteerData = { id: d.id, ...d.data() };
          console.log("volunteer doc (fallback by authUid):", volunteerData);
          if (!cancelled) setVolunteer(volunteerData);
          return;
        }

        if (!cancelled) {
          setVolunteer(null);
          setError("לא נמצא קישור לפרופיל מתנדב. יש לפנות למנהל.");
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