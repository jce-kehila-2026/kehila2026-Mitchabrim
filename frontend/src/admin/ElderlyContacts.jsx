import { useEffect, useMemo, useState } from "react";

import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";

import {
  getElderlyContacts,
  createElderlyContact,
  updateElderlyContact,
  deleteElderlyContact,
} from "../services/elderlyContactsService";
import { getElderly } from "../services/elderlyService";

import useAreasAndNeighborhoods from "../hooks/useAreasAndNeighborhoods";

/* =========================
   Options
========================= */

const RELATION_TYPES = ["עו״ס", "בן / בת משפחה", "שכן / שכנה", "חבר / חברה", "איש קשר אחר"];
const STATUS_OPTIONS = ["פעיל", "לא פעיל"];
const LINK_OPTIONS = ["מקושר לאזרח ותיק", "לא מקושר"];

import { validatePhone, validateEmail, validateName, filterDigits, filterName } from "@/utils/validation";
const Req = () => <span style={{ color: "#dc2626", marginInlineStart: 4 }}>*</span>;
const FieldError = ({ msg }) =>
  msg ? <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{msg}</div> : null;

const statusBadge = (s) => (s === "פעיל" ? "badge-green" : "badge-gray");

const elderlyDisplayName = (e) =>
  `${e?.firstName || ""} ${e?.lastName || ""}`.trim() || e?.name || "אזרח ותיק";

export default function ElderlyContacts() {
  const [contacts, setContacts] = useState([]);
  const [elderlyList, setElderlyList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [viewContact, setViewContact] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [fArea, setFArea] = useState("");
  const [fNeighborhood, setFNeighborhood] = useState("");
  const [fRelation, setFRelation] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fLink, setFLink] = useState("");

  const { areaNames, getNeighborhoods, loading: areasLoading } = useAreasAndNeighborhoods();

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const reload = async () => {
    try {
      setLoading(true);
      setError("");
      const [c, e] = await Promise.all([
        getElderlyContacts(),
        getElderly().catch(() => []),
      ]);
      setContacts(c);
      setElderlyList(e);
    } catch (err) {
      console.error(err);
      setError("שגיאה בטעינת אנשי הקשר");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  // Map: contactId -> array of elderly that selected this contact person
  const elderlyByContact = useMemo(() => {
    const m = new Map();
    for (const e of elderlyList) {
      const cid = e.contactPersonId;
      if (!cid) continue;
      const arr = m.get(cid) || [];
      arr.push(e);
      m.set(cid, arr);
    }
    return m;
  }, [elderlyList]);

  // Derived list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      const linkedElderly = elderlyByContact.get(c.id) || [];
      const linkedNames = linkedElderly.map((e) => elderlyDisplayName(e).toLowerCase()).join(" ");

      if (q) {
        const hay = [c.fullName, c.firstName, c.lastName, c.phone, c.relationType, linkedNames]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fArea) {
        const inArea = linkedElderly.some((e) => e.area === fArea);
        if (!inArea) return false;
      }
      if (fNeighborhood) {
        const inN = linkedElderly.some((e) => e.neighborhood === fNeighborhood);
        if (!inN) return false;
      }
      if (fRelation && c.relationType !== fRelation) return false;
      if (fStatus && c.status !== fStatus) return false;
      if (fLink === "מקושר לאזרח ותיק" && linkedElderly.length === 0) return false;
      if (fLink === "לא מקושר" && linkedElderly.length > 0) return false;
      return true;
    });
  }, [contacts, elderlyByContact, search, fArea, fNeighborhood, fRelation, fStatus, fLink]);

  const stats = useMemo(() => {
    const total = contacts.length;
    const linked = contacts.filter((c) => (elderlyByContact.get(c.id) || []).length > 0).length;
    const unlinked = total - linked;
    return { total, linked, unlinked };
  }, [contacts, elderlyByContact]);

  /* ========== Actions ========== */

  const handleSave = async (form, editingId) => {
    try {
      if (editingId) {
        const saved = await updateElderlyContact(editingId, form);
        setContacts((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...saved } : c)));
      } else {
        const saved = await createElderlyContact(form);
        setContacts((prev) => [saved, ...prev]);
      }
      setShowAdd(false);
      setEditContact(null);
      showToast(editingId ? "איש הקשר עודכן" : "איש הקשר נוסף");
    } catch (err) {
      console.error(err);
      alert("שגיאה בשמירת איש הקשר");
    }
  };

  const handleDelete = async (contact) => {
    const linked = elderlyByContact.get(contact.id) || [];
    if (linked.length > 0) {
      alert(
        `איש הקשר "${contact.fullName}" מקושר ל-${linked.length} אזרחים ותיקים.\nיש להסיר את הקישור מטופס האזרחים הוותיקים לפני המחיקה.`,
      );
      return;
    }
    const ok = window.confirm(`למחוק את איש הקשר "${contact.fullName}"?`);
    if (!ok) return;
    try {
      await deleteElderlyContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      showToast("נמחק");
    } catch (err) {
      console.error(err);
      alert("שגיאה במחיקה");
    }
  };

  /* ========== Render ========== */

  return (
    <AdminPageLayout heroImage="/admin-heroes/elderly_contacts_hero.png"
      title="ניהול אנשי קשר לקשישים"
      subtitle="ניהול אנשי קשר המקושרים לאזרחים ותיקים, כגון עו״סים, בני משפחה, שכנים ואנשי קשר נוספים."
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + הוספת איש קשר
          </button>
          <button className="btn" onClick={() => setShowPrint(true)}>
            הדפסת רשימה
          </button>
        </>
      }
    >
      {error && (
        <SectionCard>
          <p style={{ color: "red", fontWeight: 600 }}>{error}</p>
        </SectionCard>
      )}

      {toast && (
        <div className="admin-toast" style={{ position: "fixed", top: 24, insetInlineStart: 24, zIndex: 9999 }}>
          {toast}
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <StatsCard icon="📇" title="סה״כ אנשי קשר" value={String(stats.total)} />
        <StatsCard icon="🔗" title="מקושרים לאזרח ותיק" value={String(stats.linked)} />
        <StatsCard icon="🚫" title="לא מקושרים" value={String(stats.unlinked)} />
      </div>

      <SectionCard>
        <SearchFilters
          searchPlaceholder="חיפוש לפי שם, טלפון, סוג קשר או שם אזרח ותיק..."
          searchValue={search}
          onSearchChange={(e) => setSearch(e.target.value)}
          filters={[
            {
              key: "area",
              label: "אזור",
              value: fArea,
              onChange: (e) => {
                setFArea(e.target.value);
                setFNeighborhood("");
              },
              options: ["", ...areaNames],
            },
            {
              key: "neighborhood",
              label: "שכונה",
              value: fNeighborhood,
              onChange: (e) => setFNeighborhood(e.target.value),
              options: ["", ...getNeighborhoods(fArea)],
            },
            {
              key: "relation",
              label: "סוג קשר",
              value: fRelation,
              onChange: (e) => setFRelation(e.target.value),
              options: ["", ...RELATION_TYPES],
            },
            {
              key: "status",
              label: "סטטוס",
              value: fStatus,
              onChange: (e) => setFStatus(e.target.value),
              options: ["", ...STATUS_OPTIONS],
            },
            {
              key: "link",
              label: "מצב קישור",
              value: fLink,
              onChange: (e) => setFLink(e.target.value),
              options: ["", ...LINK_OPTIONS],
            },
          ]}
        />

        {loading || areasLoading ? (
          <p style={{ padding: 20 }}>טוען אנשי קשר...</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 20, color: "#666", textAlign: "center" }}>לא נמצאו אנשי קשר לקשישים</p>
        ) : (
          <DataTable
            columns={[
              {
                key: "name",
                label: "שם",
                render: (r) => (
                  <button className="link-btn" onClick={() => setViewContact(r)}>
                    {r.fullName || `${r.firstName || ""} ${r.lastName || ""}`}
                  </button>
                ),
              },
              { key: "phone", label: "טלפון" },
              { key: "relationType", label: "סוג קשר", render: (r) => r.relationType || "—" },
              {
                key: "linked",
                label: "אזרח ותיק מקושר",
                render: (r) => {
                  const ls = elderlyByContact.get(r.id) || [];
                  if (ls.length === 0) return <span className="badge badge-gray">לא מקושר</span>;
                  if (ls.length === 1) return elderlyDisplayName(ls[0]);
                  return <span>מקושר ל-{ls.length} אזרחים</span>;
                },
              },
              {
                key: "area",
                label: "שכונה / אזור",
                render: (r) => {
                  const ls = elderlyByContact.get(r.id) || [];
                  if (ls.length === 0) return "—";
                  const first = ls[0];
                  return `${first.neighborhood || "—"} / ${first.area || "—"}`;
                },
              },
              {
                key: "status",
                label: "סטטוס",
                render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status || "פעיל"}</span>,
              },
              { key: "contactDate", label: "תאריך יצירת קשר", render: (r) => r.contactDate || "—" },
              { key: "notes", label: "הערות", render: (r) => (r.notes ? r.notes.slice(0, 40) : "—") },
              {
                key: "actions",
                label: "פעולות",
                render: (r) => (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="btn btn-sm" onClick={() => setViewContact(r)}>
                      צפייה
                    </button>
                    <button className="btn btn-sm" onClick={() => setEditContact(r)}>
                      עריכה
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ color: "#b91c1c" }}
                      onClick={() => handleDelete(r)}
                    >
                      מחיקה
                    </button>
                  </div>
                ),
              },
            ]}
            data={filtered}
          />
        )}
      </SectionCard>

      {(showAdd || editContact) && (
        <ContactModal
          editing={editContact}
          onClose={() => {
            setShowAdd(false);
            setEditContact(null);
          }}
          onSave={handleSave}
        />
      )}

      {viewContact && (
        <ViewContactModal
          contact={viewContact}
          linkedElderly={elderlyByContact.get(viewContact.id) || []}
          onClose={() => setViewContact(null)}
          onEdit={() => {
            setEditContact(viewContact);
            setViewContact(null);
          }}
        />
      )}

      {showPrint && (
        <PrintContactsModal
          contacts={contacts}
          elderlyByContact={elderlyByContact}
          areaNames={areaNames}
          getNeighborhoods={getNeighborhoods}
          onClose={() => setShowPrint(false)}
        />
      )}
    </AdminPageLayout>
  );
}

/* =========================
   Add / Edit Modal
========================= */

function ContactModal({ editing, onClose, onSave }) {
  const [form, setForm] = useState({
    firstName: editing?.firstName || "",
    lastName: editing?.lastName || "",
    phone: editing?.phone || "",
    email: editing?.email || "",
    address: editing?.address || "",
    relationType: editing?.relationType || RELATION_TYPES[0],
    status: editing?.status || "פעיל",
    contactDate: editing?.contactDate || "",
    notes: editing?.notes || "",
  });

  const [errors, setErrors] = useState({});

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const e = {};
    const nameErr1 = validateName(form.firstName, { required: true });
    if (nameErr1) e.firstName = nameErr1;
    const nameErr2 = validateName(form.lastName, { required: true });
    if (nameErr2) e.lastName = nameErr2;
    const phoneErr = validatePhone(form.phone, { required: true });
    if (phoneErr) e.phone = phoneErr;
    const emailErr = validateEmail(form.email, { required: false });
    if (emailErr) e.email = emailErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave(form, editing?.id);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820 }}>
        <div className="modal-header">
          <h2>{editing ? "עריכת איש קשר" : "הוספת איש קשר"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <h4>פרטים אישיים</h4>
          <div className="row row-2">
            <div className="field">
              <label>שם פרטי<Req /></label>
              <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: filterName(e.target.value) })} />
              <FieldError msg={errors.firstName} />
            </div>
            <div className="field">
              <label>שם משפחה<Req /></label>
              <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: filterName(e.target.value) })} />
              <FieldError msg={errors.lastName} />
            </div>
            <div className="field">
              <label>טלפון<Req /></label>
              <input className="input" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: filterDigits(e.target.value, 10) })} />
              <FieldError msg={errors.phone} />
            </div>
            <div className="field">
              <label>מייל</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} />
              <FieldError msg={errors.email} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>כתובת</label>
              <input className="input" value={form.address} onChange={set("address")} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>פרטי קשר</h4>
          <div className="row row-2">
            <div className="field">
              <label>סוג קשר<Req /></label>
              <select className="select" value={form.relationType} onChange={set("relationType")}>
                {RELATION_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>סטטוס</label>
              <select className="select" value={form.status} onChange={set("status")}>
                {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>תאריך יצירת קשר</label>
              <input className="input" type="date" value={form.contactDate} onChange={set("contactDate")} />
            </div>
          </div>
          <div className="field">
            <label>הערות</label>
            <textarea className="textarea" rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSubmit}>שמירה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   View Contact Modal
========================= */

function ViewContactModal({ contact, linkedElderly, onClose, onEdit }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2>פרטי איש קשר</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <div className="detail-grid">
            <div className="item"><label>שם מלא</label><div>{contact.fullName || "—"}</div></div>
            <div className="item"><label>טלפון</label><div>{contact.phone || "—"}</div></div>
            <div className="item"><label>מייל</label><div>{contact.email || "—"}</div></div>
            <div className="item"><label>כתובת</label><div>{contact.address || "—"}</div></div>
            <div className="item"><label>סוג קשר</label><div>{contact.relationType || "—"}</div></div>
            <div className="item"><label>סטטוס</label>
              <div><span className={`badge ${statusBadge(contact.status)}`}>{contact.status || "פעיל"}</span></div>
            </div>
            <div className="item"><label>תאריך יצירת קשר</label><div>{contact.contactDate || "—"}</div></div>
          </div>
          {contact.notes && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 600 }}>הערות</label>
              <p style={{ margin: "4px 0 0", color: "#374151" }}>{contact.notes}</p>
            </div>
          )}
        </div>

        <div className="form-section">
          <h4>אזרחים ותיקים מקושרים ({linkedElderly.length})</h4>
          {linkedElderly.length === 0 ? (
            <p style={{ color: "#6b7280" }}>אינו מקושר לאזרח ותיק</p>
          ) : (
            <ul style={{ paddingInlineStart: 20, margin: 0 }}>
              {linkedElderly.map((e) => (
                <li key={e.id}>
                  {elderlyDisplayName(e)}
                  <span style={{ color: "#6b7280", marginInlineStart: 8, fontSize: 13 }}>
                    {e.neighborhood || ""} {e.area ? `/ ${e.area}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
            הקישור בין אזרח ותיק לאיש קשר מנוהל מטופס האזרח הוותיק.
          </p>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onEdit}>עריכה</button>
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Print Modal
========================= */

function PrintContactsModal({ contacts, elderlyByContact, areaNames, getNeighborhoods, onClose }) {
  const [sel, setSel] = useState({
    area: "",
    neighborhood: "",
    relation: "",
    status: "",
    link: "",
  });
  const [showPreview, setShowPreview] = useState(false);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const ls = elderlyByContact.get(c.id) || [];
      if (sel.area && !ls.some((e) => e.area === sel.area)) return false;
      if (sel.neighborhood && !ls.some((e) => e.neighborhood === sel.neighborhood)) return false;
      if (sel.relation && c.relationType !== sel.relation) return false;
      if (sel.status && c.status !== sel.status) return false;
      if (sel.link === "מקושר לאזרח ותיק" && ls.length === 0) return false;
      if (sel.link === "לא מקושר" && ls.length > 0) return false;
      return true;
    });
  }, [contacts, elderlyByContact, sel]);

  const setF = (k) => (e) => {
    const v = e.target.value;
    if (k === "area") {
      setSel({ ...sel, area: v, neighborhood: "" });
      return;
    }
    setSel({ ...sel, [k]: v });
  };

  const handleDownload = () => {
    const headers = ["שם", "טלפון", "מייל", "סוג קשר", "סטטוס", "אזרחים מקושרים"];
    const rows = filtered.map((c) => {
      const ls = elderlyByContact.get(c.id) || [];
      return [
        c.fullName || "",
        c.phone || "",
        c.email || "",
        c.relationType || "",
        c.status || "",
        ls.map((e) => elderlyDisplayName(e)).join(" | "),
      ];
    });
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "elderly-contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 980 }}>
        <div className="modal-header">
          <h2>הכנת דוח אנשי קשר להדפסה</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section no-print">
          <h4>סינון לדוח</h4>
          <div className="filters-row">
            <select className="filter-pill" value={sel.area} onChange={setF("area")}>
              <option value="">אזור</option>
              {areaNames.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className="filter-pill" value={sel.neighborhood} onChange={setF("neighborhood")}>
              <option value="">שכונה</option>
              {getNeighborhoods(sel.area).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className="filter-pill" value={sel.relation} onChange={setF("relation")}>
              <option value="">סוג קשר</option>
              {RELATION_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className="filter-pill" value={sel.status} onChange={setF("status")}>
              <option value="">סטטוס</option>
              {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className="filter-pill" value={sel.link} onChange={setF("link")}>
              <option value="">מצב קישור</option>
              {LINK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {showPreview && (
          <div className="form-section">
            <h4>תצוגה מקדימה ({filtered.length} אנשי קשר)</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>טלפון</th>
                    <th>סוג קשר</th>
                    <th>סטטוס</th>
                    <th>אזרחים מקושרים</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const ls = elderlyByContact.get(c.id) || [];
                    return (
                      <tr key={c.id}>
                        <td>{c.fullName}</td>
                        <td>{c.phone}</td>
                        <td>{c.relationType}</td>
                        <td>{c.status}</td>
                        <td>{ls.map((e) => elderlyDisplayName(e)).join(", ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-actions no-print">
          <button className="btn btn-primary" onClick={() => setShowPreview(true)}>תצוגה מקדימה</button>
          <button className="btn" onClick={handleDownload}>הורדת דוח</button>
          <button className="btn" onClick={() => window.print()}>הדפסה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
