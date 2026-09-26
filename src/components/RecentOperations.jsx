const operations = [
  ["REC-001", "Receipt", "Steel Rods", "+100", "Done"],
  ["DEL-002", "Delivery", "Office Chairs", "-20", "Ready"],
  ["TRF-003", "Transfer", "Steel Rods", "20", "Waiting"]
];

export default function RecentOperations() {
  return (
    <div>
      <h2>Recent Operations</h2>

      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Type</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {operations.map((operation) => (
            <tr key={operation[0]}>
              {operation.map((value, index) => (
                <td key={index}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}