function SearchFilters({ searchPlaceholder, filters }) {
  return (
    <div className="search-filters">
      <input
        type="text"
        placeholder={searchPlaceholder}
      />
      {filters && filters.map((filter, index) => (
        <select key={index}>
          <option value="">{filter.label}</option>
          {filter.options && filter.options.map((option, idx) => (
            <option key={idx} value={option.value}>{option.label}</option>
          ))}
        </select>
      ))}
    </div>
  );
}

export default SearchFilters;