import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" aria-live="polite" dir="rtl" style={{
      position: "sticky",
      top: 0,
      zIndex: 99999,
      padding: "9px 16px",
      textAlign: "center",
      color: "#fff",
      background: "#8b2c2c",
      fontWeight: 700,
    }}>
      אין חיבור לרשת. קריאות עשויות להיכשל וכתיבות לא יישלחו מחדש אוטומטית.
    </div>
  );
}
