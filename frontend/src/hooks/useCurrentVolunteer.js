import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getVolunteerForUser } from "../services/volunteersService";

/**
 * Loads the volunteer profile linked to the currently logged-in user.
 *
 * Primary path: users/{uid}.linkedVolunteerId -> volunteers/{linkedVolunteerId}
 * Fallback: volunteers where authUid == currentUser.uid (guarded).
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
        const { volunteer: vol, error: errMsg } = await getVolunteerForUser({
          uid: user.uid,
          email: user.email,
        });
        if (cancelled) return;
        setVolunteer(vol);
        if (errMsg) setError(errMsg);
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
  }, [user?.uid, user?.email]);

  return { volunteer, loading, error, linked: !!volunteer };
}
