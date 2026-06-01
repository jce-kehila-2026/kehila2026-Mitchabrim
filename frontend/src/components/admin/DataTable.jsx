export default function DataTable({ columns = [], data = [] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key || c.label}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map((c) => (
                <td key={c.key || c.label} className={c.key === "actions" ? "actions" : ""}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={columns.length} style={{ textAlign: "center", color: "var(--color-text-muted)", padding: 24 }}>אין נתונים להצגה</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
