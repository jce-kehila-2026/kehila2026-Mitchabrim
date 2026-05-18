function DataTable({ columns, data }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((col, index) => (
            <th key={index}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {columns.map((col, idx) => (
              <td key={idx}>
                {col === 'פעולה' ? (
                  <button className="action-btn">עריכה</button>
                ) : (
                  row[col] || ''
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default DataTable;