const movements = [
  {
    ref: "REC-001",
    product: "Steel Rods",
    operation: "Receipt",
    quantity: "+100",
    status: "Done"
  },
  {
    ref: "DEL-001",
    product: "Office Chair",
    operation: "Delivery",
    quantity: "-20",
    status: "Done"
  },
  {
    ref: "TRF-001",
    product: "Steel Rods",
    operation: "Transfer",
    quantity: "20",
    status: "Done"
  }
];

export default function MoveHistory() {
  return (
    <div>
      <h1>Move History</h1>

      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Product</th>
            <th>Operation</th>
            <th>Quantity</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {movements.map((move) => (
            <tr key={move.ref}>
              <td>{move.ref}</td>
              <td>{move.product}</td>
              <td>{move.operation}</td>
              <td>{move.quantity}</td>
              <td>{move.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}