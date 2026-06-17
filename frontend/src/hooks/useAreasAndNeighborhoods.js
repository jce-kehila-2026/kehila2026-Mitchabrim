import { useEffect, useMemo, useState } from "react";
import { getAreasAndNeighborhoods } from "../services/settingsService";

/**
 * Shared hook that loads areas + neighborhoods from `settings/general`.
 * Used by Elderly and Volunteers screens (forms + filters) so that all
 * area/neighborhood dropdowns are driven by the same Firestore data.
 */
export default function useAreasAndNeighborhoods() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getAreasAndNeighborhoods();
        if (!mounted) return;
        setAreas(data);
      } catch (err) {
        console.error("Failed to load areas/neighborhoods:", err);
        if (mounted) setError("אירעה שגיאה בטעינת האזורים");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const areaNames = useMemo(() => areas.map((a) => a.area), [areas]);

  const allNeighborhoods = useMemo(
    () => Array.from(new Set(areas.flatMap((a) => a.neighborhoods || []))),
    [areas],
  );

  const getNeighborhoods = (areaName) => {
    if (!areaName) return allNeighborhoods;
    const found = areas.find((a) => a.area === areaName);
    return found ? found.neighborhoods : [];
  };

  return {
    areas,
    areaNames,
    allNeighborhoods,
    getNeighborhoods,
    loading,
    error,
    isEmpty: !loading && !error && areas.length === 0,
  };
}
