import { useState } from "react";

export default function SiteSectionCard({
  order,
  name,
  publicName,
  description,
  layoutPreview,
  onSave,
  children,
}) {
  const [state, setState] = useState({ saving: false, ok: false, err: "" });

  const handleSave = async () => {
    setState({ saving: true, ok: false, err: "" });
    try {
      await onSave();
      setState({ saving: false, ok: true, err: "" });
      setTimeout(() => setState((s) => ({ ...s, ok: false })), 2500);
    } catch (e) {
      console.error(e);
      setState({ saving: false, ok: false, err: e.message || "שגיאה בשמירה" });
    }
  };

  return (
    <section className="sc-card">
      <header className="sc-card-head">
        <div className="sc-card-head-text">
          <div className="sc-badge-row">
            <span className="sc-order-badge">#{order}</span>
            <span className="sc-public-badge">מופיע באתר הציבורי › {publicName}</span>
          </div>
          <h3 className="sc-card-title">{name}</h3>
          {description && <p className="sc-card-desc">{description}</p>}
        </div>
        {layoutPreview && <div className="sc-layout-preview">{layoutPreview}</div>}
      </header>

      <div className="sc-card-body">{children}</div>

      <footer className="sc-card-foot">
        {state.ok && <span className="sc-status sc-status-ok">✓ נשמר בהצלחה</span>}
        {state.err && <span className="sc-status sc-status-err">✕ {state.err}</span>}
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={state.saving}
        >
          {state.saving ? "שומר..." : "שמירת שינויים בסקציה זו"}
        </button>
      </footer>
    </section>
  );
}
