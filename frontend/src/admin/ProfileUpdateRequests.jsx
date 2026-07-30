import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import LoadingLine from "@/components/common/LoadingLine.jsx";
import EmptyState from "@/components/common/EmptyState.jsx";
import ProfileUpdateRequestModal, {
  ProfileUpdateRequestStatusBadge,
} from "@/components/admin/ProfileUpdateRequestModal.jsx";
import {
  getProfileUpdateRequestById,
  getProfileUpdateRequestsPageForAdmin,
} from "@/services/profileUpdateRequestsService";



export default function ProfileUpdateRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState("pending"); // all|pending|approved|rejected
  const [active, setActive] = useState(null);
  const [params] = useSearchParams();
  const pageCursor = useRef(null);

  const loadPage = useCallback(async ({ reset = false } = {}) => {
    reset ? setLoading(true) : setLoadingMore(true);
    setLoadError("");
    try {
      const page = await getProfileUpdateRequestsPageForAdmin({
        status: filter,
        cursor: reset ? null : pageCursor.current,
      });
      pageCursor.current = page.cursor;
      setHasMore(page.hasMore);
      setRequests((current) => reset ? page.items : [...current, ...page.items]);
    } catch (err) {
      console.warn("profile requests page load:", err?.code || err?.message);
      setLoadError("לא ניתן לטעון את הבקשות כרגע.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    pageCursor.current = null;
    setRequests([]);
    loadPage({ reset: true });
  }, [loadPage]);

  // Open specific request via ?id=
  useEffect(() => {
    const id = params.get("id");
    if (!id) return;
    const loaded = requests.find((request) => request.id === id);
    if (loaded) {
      setActive(loaded);
      return;
    }
    getProfileUpdateRequestById(id)
      .then((request) => request && setActive(request))
      .catch((err) => console.warn("profile request direct load:", err?.code || err?.message));
  }, [params, requests]);

  return (
    <AdminLayout title="בקשות לעדכון פרטי מתנדבים" subtitle="ניהול בקשות שנשלחו מהמתנדבים">
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { k: "all", label: "הכל" },
            { k: "pending", label: "ממתינות" },
            { k: "approved", label: "אושרו" },
            { k: "rejected", label: "נדחו" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className={filter === t.k ? "btn btn-primary" : "btn"}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loadError && <div className="vol-alert-error" style={{ marginBottom: 12 }}>{loadError}</div>}
        {loading ? (
          <LoadingLine />
        ) : requests.length === 0 ? (
          <EmptyState text="אין בקשות להצגה" style={{ color: "#6c757d" }} />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {requests.map((r) => (
              <RequestCard key={r.id} request={r} onOpen={() => setActive(r)} />
            ))}
          </div>
        )}
        {hasMore && !loading && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <button className="btn" onClick={() => loadPage()} disabled={loadingMore}>
              {loadingMore ? "טוען…" : "טעינת בקשות נוספות"}
            </button>
          </div>
        )}
      </div>

      {active && (
        <ProfileUpdateRequestModal
          request={active}
          onClose={() => setActive(null)}
          onDecided={(updated) => {
            setRequests((current) => {
              if (filter === "pending") {
                return current.filter((request) => request.id !== updated.id);
              }
              return current.map((request) => request.id === updated.id ? updated : request);
            });
            setActive(updated);
          }}
        />
      )}
    </AdminLayout>
  );
}

function RequestCard({ request, onOpen }) {
  const d = request.createdAt?.toDate ? request.createdAt.toDate() : null;
  return (
    <div
      onClick={onOpen}
      style={{
        border: "1px solid #f0e6d6",
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, color: "#3c2a1e" }}>{request.volunteerName}</div>
        <ProfileUpdateRequestStatusBadge status={request.status} />
      </div>
      <div style={{ fontSize: 13, color: "#5a3a2a", whiteSpace: "pre-wrap", marginBottom: 6 }}>
        {request.message.length > 160 ? request.message.slice(0, 160) + "…" : request.message}
      </div>
      {d && (
        <div style={{ fontSize: 12, color: "#9e8a7a" }}>
          {d.toLocaleDateString("he-IL")} {d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}
