const stats = [
  ["Total Products", 1248],
  ["Low Stock", 24],
  ["Out of Stock", 8],
  ["Pending Receipts", 12],
  ["Pending Deliveries", 18],
  ["Internal Transfers", 7]
];

export default function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Inventory Dashboard</h1>
      <p>Overview of your inventory operations</p>

      <div className="stats-grid">
        {stats.map(([title, value]) => (
          <div className="stat-card" key={title}>
            <p>{title}</p>
            <h2>{value}</h2>
          </div>
        ))}
      </div>
    </div>
  );
}