// src/components/admin/SearchFilters.jsx
export default function SearchFilters({ 
  searchPlaceholder = "חיפוש...", 
  searchValue = "",
  onSearchChange = () => {},
  filters = [] 
}) {
  return (
    <div className="search-filter-panel">
      <div className="search-input-wrapper">
        <input 
          className="search-input" 
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={onSearchChange}
        />
        <span className="search-input-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
      </div>
      {filters.length > 0 && (
        <div className="filters-row">
          <span className="filters-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            סינון:
          </span>
          {filters.map((f, i) => (
            <label key={i} className="filter-field">
              {f.label && <span className="filter-field-label">{f.label}</span>}
              <select
                className="filter-pill"
                value={f.value || ""}
                onChange={f.onChange || (() => {})}
              >
                {(f.options || []).map((o) => (
                  <option key={o} value={o}>{o === "" ? `כל ה${f.label || "ערכים"}` : o}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}