import { useState } from "react";

export function TextField({ label, helper, value, onChange, placeholder }) {
  return (
    <label className="sc-field">
      <span className="sc-field-label">{label}</span>
      {helper && <span className="sc-field-helper">{helper}</span>}
      <input
        type="text"
        className="sc-input"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function TextareaField({ label, helper, value, onChange, rows = 4 }) {
  return (
    <label className="sc-field">
      <span className="sc-field-label">{label}</span>
      {helper && <span className="sc-field-helper">{helper}</span>}
      <textarea
        className="sc-input sc-textarea"
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function ImageField({ label, helper, value, onChange }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="sc-field sc-image-field">
      <span className="sc-field-label">🖼️ {label}</span>
      {helper && <span className="sc-field-helper">{helper}</span>}
      <div className="sc-image-row">
        <div className="sc-image-preview">
          {value && !broken ? (
            <img
              src={value}
              alt={label}
              onError={() => setBroken(true)}
              onLoad={() => setBroken(false)}
            />
          ) : (
            <span className="sc-image-placeholder">אין תמונה</span>
          )}
        </div>
        <div className="sc-image-controls">
          <input
            type="text"
            dir="ltr"
            className="sc-input"
            value={value ?? ""}
            placeholder="https://..."
            onChange={(e) => {
              setBroken(false);
              onChange(e.target.value);
            }}
          />
          <div className="sc-image-buttons">
            <button
              type="button"
              className="btn sc-btn-ghost"
              onClick={() => onChange("")}
              disabled={!value}
            >
              מחיקת תמונה
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
