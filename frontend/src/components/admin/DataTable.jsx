// src/components/admin/DataTable.jsx
export default function DataTable({ columns = [], data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "#666", padding: "24px" }}>
        אין נתונים להצגה
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key || c.label}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row.id || idx}>
              {columns.map((c) => (
                <td key={c.key || c.label} className={c.key === "actions" ? "actions" : ""}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}