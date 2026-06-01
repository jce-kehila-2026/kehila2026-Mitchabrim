export default function SearchFilters({ searchPlaceholder = "חיפוש...", filters = [] }) {
  return (
    <div className="search-filter-panel">
      <div className="search-input-wrapper">
        <input className="search-input" placeholder={searchPlaceholder} />
        <span className="search-input-icon" aria-hidden="true">
          {/* magnifier */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </span>
      </div>
      {filters.length > 0 && (
        <div className="filters-row">
          <span className="filters-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            סינון:
          </span>
          {filters.map((f, i) => (
            <select key={i} className="filter-pill" defaultValue="">
              <option value="">{f.label}</option>
              {(f.options || []).map((o) => (<option key={o}>{o}</option>))}
            </select>
          ))}
        </div>
      )}
    </div>
  );
}
