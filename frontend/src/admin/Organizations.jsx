import { useEffect, useMemo, useState } from "react";

import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";

import {
  getOrganizations,
  getAllOrganizationContacts,
  getContactsForOrganization,
  createOrganizationWithPrimaryContact,
  updateOrganization,
  deleteOrganization,
  archiveOrganization,
  createOrganizationContact,
  updateOrganizationContact,
  deleteOrganizationContact,
  setPrimaryContact,
} from "../services/organizationsService";

/* =========================
   Options
========================= */

const CATEGORY_OPTIONS = [
  "גופי התנדבות",
  "גופי תרומות",
  "שיתופי פעולה",
  "תרבות ואירועים",
];
const STATUS_OPTIONS = ["פעיל", "לא פעיל"];

import { validatePhone, validateEmail, validateName, filterDigits, filterName } from "@/utils/validation";
import { sanitizeFormData } from "@/utils/sanitize";
const Req = () => <span style={{ color: "#dc2626", marginInlineStart: 4 }}>*</span>;
const FieldError = ({ msg }) =>
  msg ? <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{msg}</div> : null;

const statusBadge = (s) => (s === "פעיל" ? "badge-green" : "badge-gray");
const categoryBadge = (c) => {
  switch (c) {
    case "גופי התנדבות":
      return "badge-green";
    case "גופי תרומות":
      return "badge-orange";
    case "שיתופי פעולה":
      return "badge-blue";
    case "תרבות ואירועים":
      return "badge-purple";
    default:
      return "badge-gray";
  }
};

/* =========================
   Main Component
========================= */

export default function Organizations() {
  const [orgs, setOrgs] = useState([]);
  const [allContacts, setAllContacts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [viewOrg, setViewOrg] = useState(null);

  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fStatus, setFStatus] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const reload = async () => {
    try {
      setLoading(true);
      setError("");
      const [o, c] = await Promise.all([
        getOrganizations(),
        getAllOrganizationContacts().catch(() => []),
      ]);
      setOrgs(o);
      setAllContacts(c);
    } catch (err) {
      console.error(err);
      setError("שגיאה בטעינת הארגונים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const contactsByOrg = useMemo(() => {
    const m = new Map();
    for (const c of allContacts) {
      const arr = m.get(c.organizationId) || [];
      arr.push(c);
      m.set(c.organizationId, arr);
    }
    return m;
  }, [allContacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgs.filter((o) => {
      if (q) {
        const hay = [
          o.organizationName,
          o.primaryContactName,
          o.phone,
          o.email,
          o.primaryContactPhone,
          o.primaryContactEmail,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fCategory && o.category !== fCategory) return false;
      if (fStatus && (o.status || "פעיל") !== fStatus) return false;
      return true;
    });
  }, [orgs, search, fCategory, fStatus]);

  const stats = useMemo(() => {
    const m = { "גופי התנדבות": 0, "גופי תרומות": 0, "שיתופי פעולה": 0, "תרבות ואירועים": 0 };
    for (const o of orgs) {
      if (m[o.category] !== undefined) m[o.category] += 1;
    }
    return m;
  }, [orgs]);

  /* ========== Actions ========== */

  const handleCreate = async (orgForm, primaryForm) => {
    try {
      const saved = await createOrganizationWithPrimaryContact(
        sanitizeFormData(orgForm),
        sanitizeFormData(primaryForm),
      );
      await reload();
      setShowAdd(false);
      showToast("הארגון נוסף בהצלחה");
      return saved;
    } catch (err) {
      console.error(err);
      alert("שגיאה בשמירת הארגון");
    }
  };

  const handleUpdate = async (id, orgForm) => {
    try {
      const clean = sanitizeFormData(orgForm);
      await updateOrganization(id, clean);
      setOrgs((prev) => prev.map((o) => (o.id === id ? { ...o, ...clean } : o)));
      setEditOrg(null);
      showToast("הארגון עודכן בהצלחה");
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון הארגון");
    }
  };

  const handleDelete = async (org) => {
    const linked = contactsByOrg.get(org.id) || [];
    if (linked.length > 0) {
      const ok = window.confirm(
        `לארגון "${org.organizationName}" יש ${linked.length} אנשי קשר. האם להעביר לארכיון במקום למחוק?`,
      );
      if (!ok) return;
      try {
        await archiveOrganization(org.id);
        setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, status: "לא פעיל", archived: true } : o)));
        showToast("הארגון הועבר לארכיון");
      } catch (err) {
        console.error(err);
        alert("שגיאה בהעברה לארכיון");
      }
      return;
    }
    const ok = window.confirm(`למחוק את הארגון "${org.organizationName}"?`);
    if (!ok) return;
    try {
      await deleteOrganization(org.id);
      setOrgs((prev) => prev.filter((o) => o.id !== org.id));
      showToast("הארגון נמחק");
    } catch (err) {
      console.error(err);
      alert("שגיאה במחיקה");
    }
  };

  /* ========== Render ========== */

  return (
    <AdminPageLayout heroImage="/admin-heroes/organizations_hero.png"
      title="ניהול ארגונים ואנשי קשר"
      subtitle="ניהול גופים, שותפים ואנשי קשר של ארגונים העובדים עם המיזם."
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + הוספת ארגון
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
        <div
          className="admin-toast"
          style={{ position: "fixed", top: 24, insetInlineStart: 24, zIndex: 9999 }}
        >
          {toast}
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatsCard icon="🤝" title="גופי התנדבות" value={String(stats["גופי התנדבות"])} />
        <StatsCard icon="💝" title="גופי תרומות" value={String(stats["גופי תרומות"])} />
        <StatsCard icon="🤲" title="שיתופי פעולה" value={String(stats["שיתופי פעולה"])} />
        <StatsCard icon="🎭" title="תרבות ואירועים" value={String(stats["תרבות ואירועים"])} />
      </div>

      <SectionCard>
        <SearchFilters
          searchPlaceholder="חיפוש לפי שם ארגון, איש קשר, טלפון או מייל..."
          searchValue={search}
          onSearchChange={(e) => setSearch(e.target.value)}
          filters={[
            {
              key: "category",
              label: "קטגוריה",
              value: fCategory,
              onChange: (e) => setFCategory(e.target.value),
              options: ["", ...CATEGORY_OPTIONS],
            },
            {
              key: "status",
              label: "סטטוס",
              value: fStatus,
              onChange: (e) => setFStatus(e.target.value),
              options: ["", ...STATUS_OPTIONS],
            },
          ]}
        />

        {loading ? (
          <p style={{ padding: 20 }}>טוען ארגונים...</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 20, color: "#666", textAlign: "center" }}>לא נמצאו ארגונים</p>
        ) : (
          <DataTable
            columns={[
              {
                key: "organizationName",
                label: "שם ארגון",
                render: (r) => (
                  <button className="link-btn" onClick={() => setViewOrg(r)}>
                    {r.organizationName || "—"}
                  </button>
                ),
              },
              {
                key: "category",
                label: "קטגוריה",
                render: (r) =>
                  r.category ? (
                    <span className={`badge ${categoryBadge(r.category)}`}>{r.category}</span>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "primaryContactName",
                label: "איש קשר ראשי",
                render: (r) => r.primaryContactName || "—",
              },
              { key: "phone", label: "טלפון", render: (r) => r.phone || r.primaryContactPhone || "—" },
              { key: "email", label: "מייל", render: (r) => r.email || r.primaryContactEmail || "—" },
              {
                key: "contactsCount",
                label: "מספר אנשי קשר",
                render: (r) => String((contactsByOrg.get(r.id) || []).length),
              },
              {
                key: "status",
                label: "סטטוס",
                render: (r) => (
                  <span className={`badge ${statusBadge(r.status || "פעיל")}`}>
                    {r.status || "פעיל"}
                  </span>
                ),
              },
              { key: "notes", label: "הערות", render: (r) => (r.notes ? r.notes.slice(0, 40) : "—") },
              {
                key: "actions",
                label: "פעולות",
                render: (r) => (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="btn btn-sm" onClick={() => setViewOrg(r)}>צפייה</button>
                    <button className="btn btn-sm" onClick={() => setEditOrg(r)}>עריכה</button>
                    <button
                      className="btn btn-sm"
                      style={{ color: "#b91c1c" }}
                      onClick={() => handleDelete(r)}
                    >
                      מחיקה / ארכיון
                    </button>
                  </div>
                ),
              },
            ]}
            data={filtered}
          />
        )}
      </SectionCard>

      {showAdd && (
        <OrganizationModal
          onClose={() => setShowAdd(false)}
          onCreate={handleCreate}
        />
      )}

      {editOrg && (
        <OrganizationModal
          editing={editOrg}
          onClose={() => setEditOrg(null)}
          onUpdate={handleUpdate}
        />
      )}

      {viewOrg && (
        <OrganizationDetailsModal
          organization={viewOrg}
          onClose={() => setViewOrg(null)}
          onChanged={async () => {
            await reload();
            const fresh = (await getOrganizations()).find((o) => o.id === viewOrg.id);
            if (fresh) setViewOrg(fresh);
          }}
          showToast={showToast}
        />
      )}

      {showPrint && (
        <PrintOrganizationsModal
          organizations={orgs}
          onClose={() => setShowPrint(false)}
        />
      )}
    </AdminPageLayout>
  );
}

/* =========================
   Add / Edit Organization Modal
========================= */

function OrganizationModal({ editing, onClose, onCreate, onUpdate }) {
  const isEdit = !!editing;
  const [form, setForm] = useState({
    organizationName: editing?.organizationName || "",
    category: editing?.category || "",
    phone: editing?.phone || "",
    email: editing?.email || "",
    website: editing?.website || "",
    address: editing?.address || "",
    status: editing?.status || "פעיל",
    notes: editing?.notes || "",
  });
  const [primary, setPrimary] = useState({
    contactName: "",
    role: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setP = (k) => (e) => setPrimary({ ...primary, [k]: e.target.value });

  const validate = () => {
    const e = {};
    if (!form.organizationName.trim()) e.organizationName = "שדה חובה";
    if (!form.category) e.category = "יש לבחור קטגוריה";
    const em = validateEmail(form.email, { required: false }); if (em) e.email = em;
    const ph = validatePhone(form.phone, { required: false }); if (ph) e.phone = ph;

    if (!isEdit) {
      const pn = validateName(primary.contactName); if (pn) e.pContactName = pn;
      const pp = validatePhone(primary.phone); if (pp) e.pPhone = pp;
      const pe = validateEmail(primary.email, { required: false }); if (pe) e.pEmail = pe;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    if (isEdit) onUpdate(editing.id, form);
    else onCreate(form, primary);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 880 }}>
        <div className="modal-header">
          <h2>{isEdit ? "עריכת ארגון" : "הוספת ארגון"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <h4>פרטי ארגון</h4>
          <div className="row row-2">
            <div className="field">
              <label>שם ארגון<Req /></label>
              <input className="input" value={form.organizationName} onChange={set("organizationName")} />
              <FieldError msg={errors.organizationName} />
            </div>
            <div className="field">
              <label>קטגוריה<Req /></label>
              <select className="select" value={form.category} onChange={set("category")}>
                <option value="">בחר קטגוריה...</option>
                {CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <FieldError msg={errors.category} />
            </div>
            <div className="field">
              <label>טלפון</label>
              <input className="input" inputMode="numeric" value={form.phone} onChange={set("phone")} />
              <FieldError msg={errors.phone} />
            </div>
            <div className="field">
              <label>מייל</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} />
              <FieldError msg={errors.email} />
            </div>
            <div className="field">
              <label>אתר אינטרנט</label>
              <input className="input" value={form.website} onChange={set("website")} placeholder="https://..." />
            </div>
            <div className="field">
              <label>סטטוס</label>
              <select className="select" value={form.status} onChange={set("status")}>
                {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>כתובת</label>
              <input className="input" value={form.address} onChange={set("address")} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>הערות</label>
              <textarea className="textarea" rows={2} value={form.notes} onChange={set("notes")} />
            </div>
          </div>
        </div>

        {!isEdit && (
          <div className="form-section">
            <h4>איש קשר ראשי</h4>
            <div className="row row-2">
              <div className="field">
                <label>שם איש קשר<Req /></label>
                <input className="input" value={primary.contactName} onChange={setP("contactName")} />
                <FieldError msg={errors.pContactName} />
              </div>
              <div className="field">
                <label>תפקיד</label>
                <input className="input" value={primary.role} onChange={setP("role")} />
              </div>
              <div className="field">
                <label>טלפון<Req /></label>
                <input className="input" inputMode="numeric" value={primary.phone} onChange={setP("phone")} />
                <FieldError msg={errors.pPhone} />
              </div>
              <div className="field">
                <label>מייל</label>
                <input className="input" type="email" value={primary.email} onChange={setP("email")} />
                <FieldError msg={errors.pEmail} />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>הערות</label>
                <textarea className="textarea" rows={2} value={primary.notes} onChange={setP("notes")} />
              </div>
            </div>
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
              ניתן להוסיף אנשי קשר נוספים לארגון לאחר היצירה, מתוך פרטי הארגון.
            </p>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSubmit}>שמירה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Organization Details Modal
========================= */

function OrganizationDetailsModal({ organization, onClose, onChanged, showToast }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editContact, setEditContact] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await getContactsForOrganization(organization.id);
      setContacts(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [organization.id]);

  const handleSaveContact = async (form, editingId) => {
    try {
      const clean = sanitizeFormData(form);
      if (editingId) {
        await updateOrganizationContact(editingId, clean);
        showToast?.("איש הקשר עודכן בהצלחה");
      } else {
        await createOrganizationContact({
          ...clean,
          organizationId: organization.id,
          organizationName: organization.organizationName,
          isPrimary: false,
        });
        showToast?.("איש הקשר נוסף בהצלחה");
      }
      setShowAddContact(false);
      setEditContact(null);
      await reload();
      await onChanged?.();
    } catch (err) {
      console.error(err);
      alert("שגיאה בשמירת איש הקשר");
    }
  };

  const handleRemove = async (c) => {
    const ok = window.confirm(`להסיר את "${c.contactName}" מהארגון?`);
    if (!ok) return;
    try {
      await deleteOrganizationContact(c.id);
      showToast?.("איש הקשר הוסר בהצלחה");
      await reload();
      await onChanged?.();
    } catch (err) {
      console.error(err);
      alert("שגיאה בהסרת איש הקשר");
    }
  };

  const handleSetPrimary = async (c) => {
    try {
      await setPrimaryContact(organization.id, c.id);
      showToast?.("נקבע כאיש קשר ראשי");
      await reload();
      await onChanged?.();
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון איש הקשר הראשי");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1000 }}>
        <div className="modal-header">
          <h2>פרטי ארגון</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <div className="detail-grid">
            <div className="item"><label>שם ארגון</label><div>{organization.organizationName || "—"}</div></div>
            <div className="item"><label>קטגוריה</label>
              <div>{organization.category ? <span className={`badge ${categoryBadge(organization.category)}`}>{organization.category}</span> : "—"}</div>
            </div>
            <div className="item"><label>טלפון</label><div>{organization.phone || "—"}</div></div>
            <div className="item"><label>מייל</label><div>{organization.email || "—"}</div></div>
            <div className="item"><label>אתר אינטרנט</label>
              <div>{organization.website ? <a href={organization.website} target="_blank" rel="noreferrer">{organization.website}</a> : "—"}</div>
            </div>
            <div className="item"><label>כתובת</label><div>{organization.address || "—"}</div></div>
            <div className="item"><label>סטטוס</label>
              <div><span className={`badge ${statusBadge(organization.status || "פעיל")}`}>{organization.status || "פעיל"}</span></div>
            </div>
          </div>
          {organization.notes && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 600 }}>הערות</label>
              <p style={{ margin: "4px 0 0", color: "#374151" }}>{organization.notes}</p>
            </div>
          )}
        </div>

        <div className="form-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>אנשי קשר בארגון ({contacts.length})</h4>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddContact(true)}>
              + הוספת איש קשר לארגון
            </button>
          </div>

          {loading ? (
            <p style={{ padding: 12 }}>טוען...</p>
          ) : contacts.length === 0 ? (
            <p style={{ padding: 12, color: "#666", textAlign: "center" }}>אין אנשי קשר בארגון</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>שם איש קשר</th>
                    <th>תפקיד</th>
                    <th>טלפון</th>
                    <th>מייל</th>
                    <th>ראשי</th>
                    <th>הערות</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td>{c.contactName}</td>
                      <td>{c.role || "—"}</td>
                      <td>{c.phone || "—"}</td>
                      <td>{c.email || "—"}</td>
                      <td>
                        {c.isPrimary ? (
                          <span className="badge badge-green">ראשי</span>
                        ) : (
                          <span className="badge badge-gray">—</span>
                        )}
                      </td>
                      <td>{c.notes ? c.notes.slice(0, 30) : "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button className="btn btn-sm" onClick={() => setEditContact(c)}>עריכה</button>
                          {!c.isPrimary && (
                            <button className="btn btn-sm" onClick={() => handleSetPrimary(c)}>
                              הגדר כראשי
                            </button>
                          )}
                          <button
                            className="btn btn-sm"
                            style={{ color: "#b91c1c" }}
                            onClick={() => handleRemove(c)}
                          >
                            הסרה
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>

        {(showAddContact || editContact) && (
          <ContactPersonModal
            editing={editContact}
            onClose={() => {
              setShowAddContact(false);
              setEditContact(null);
            }}
            onSave={handleSaveContact}
          />
        )}
      </div>
    </div>
  );
}

/* =========================
   Contact Person Modal (within org details)
========================= */

function ContactPersonModal({ editing, onClose, onSave }) {
  const [form, setForm] = useState({
    contactName: editing?.contactName || "",
    role: editing?.role || "",
    phone: editing?.phone || "",
    email: editing?.email || "",
    notes: editing?.notes || "",
  });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const e = {};
    const nm = validateName(form.contactName); if (nm) e.contactName = nm;
    const ph = validatePhone(form.phone); if (ph) e.phone = ph;
    const em = validateEmail(form.email, { required: false }); if (em) e.email = em;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2>{editing ? "עריכת איש קשר" : "הוספת איש קשר"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <div className="row row-2">
            <div className="field">
              <label>שם איש קשר<Req /></label>
              <input className="input" value={form.contactName} onChange={set("contactName")} />
              <FieldError msg={errors.contactName} />
            </div>
            <div className="field">
              <label>תפקיד</label>
              <input className="input" value={form.role} onChange={set("role")} />
            </div>
            <div className="field">
              <label>טלפון<Req /></label>
              <input className="input" inputMode="numeric" value={form.phone} onChange={set("phone")} />
              <FieldError msg={errors.phone} />
            </div>
            <div className="field">
              <label>מייל</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} />
              <FieldError msg={errors.email} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>הערות</label>
              <textarea className="textarea" rows={2} value={form.notes} onChange={set("notes")} />
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!validate()) return;
              onSave(form, editing?.id);
            }}
          >
            שמירה
          </button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Print Modal
========================= */

function PrintOrganizationsModal({ organizations, onClose }) {
  const [sel, setSel] = useState({ category: "", status: "" });
  const [showPreview, setShowPreview] = useState(false);

  const filtered = useMemo(() => {
    return organizations.filter((o) => {
      if (sel.category && o.category !== sel.category) return false;
      if (sel.status && (o.status || "פעיל") !== sel.status) return false;
      return true;
    });
  }, [organizations, sel]);

  const setF = (k) => (e) => setSel({ ...sel, [k]: e.target.value });

  const handleDownload = () => {
    const headers = ["שם ארגון", "קטגוריה", "איש קשר ראשי", "טלפון", "מייל", "סטטוס", "הערות"];
    const rows = filtered.map((o) => [
      o.organizationName || "",
      o.category || "",
      o.primaryContactName || "",
      o.phone || o.primaryContactPhone || "",
      o.email || o.primaryContactEmail || "",
      o.status || "פעיל",
      o.notes || "",
    ]);
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "organizations.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 980 }}>
        <div className="modal-header">
          <h2>הכנת דוח ארגונים להדפסה</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section no-print">
          <h4>סינון לדוח</h4>
          <div className="filters-row">
            <select className="filter-pill" value={sel.category} onChange={setF("category")}>
              <option value="">קטגוריה</option>
              {CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className="filter-pill" value={sel.status} onChange={setF("status")}>
              <option value="">סטטוס</option>
              {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {showPreview && (
          <div className="form-section">
            <h4>תצוגה מקדימה ({filtered.length} ארגונים)</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>שם ארגון</th>
                    <th>קטגוריה</th>
                    <th>איש קשר ראשי</th>
                    <th>טלפון</th>
                    <th>מייל</th>
                    <th>סטטוס</th>
                    <th>הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id}>
                      <td>{o.organizationName}</td>
                      <td>{o.category}</td>
                      <td>{o.primaryContactName || "—"}</td>
                      <td>{o.phone || o.primaryContactPhone || "—"}</td>
                      <td>{o.email || o.primaryContactEmail || "—"}</td>
                      <td>{o.status || "פעיל"}</td>
                      <td>{o.notes || "—"}</td>
                    </tr>
                  ))}
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
