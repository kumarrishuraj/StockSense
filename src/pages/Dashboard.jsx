import React from "react";

const stats = [
  { title: "Total Products", value: "1,248" },
  { title: "Low Stock", value: "24" },
  { title: "Out of Stock", value: "8" },
  { title: "Pending Receipts", value: "12" },
  { title: "Pending Deliveries", value: "18" },
  { title: "Internal Transfers", value: "7" },
];

function Dashboard() {
  return (
    <div className="dashboard">

      <div className="dashboard-header">
        <div>
          <h1>Inventory Dashboard</h1>
          <p>Overview of your inventory operations</p>
        </div>

        <button className="primary-btn">
          + New Operation
        </button>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.title}>
            <p>{stat.title}</p>
            <h2>{stat.value}</h2>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-section">
        <h2>Inventory Operations</h2>

        <div className="filters">
          <select>
            <option>All Document Types</option>
            <option>Receipts</option>
            <option>Delivery</option>
            <option>Internal</option>
            <option>Adjustments</option>
          </select>

          <select>
            <option>All Status</option>
            <option>Draft</option>
            <option>Waiting</option>
            <option>Ready</option>
            <option>Done</option>
            <option>Canceled</option>
          </select>

          <select>
            <option>All Warehouses</option>
            <option>Main Warehouse</option>
            <option>Warehouse 2</option>
          </select>

          <select>
            <option>All Categories</option>
            <option>Raw Material</option>
            <option>Finished Goods</option>
            <option>Electronics</option>
          </select>
        </div>
      </div>

      {/* Recent Operations */}
      <div className="operations-card">
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
            <tr>
              <td>REC-001</td>
              <td>Receipt</td>
              <td>Steel Rods</td>
              <td>+100</td>
              <td><span className="status done">Done</span></td>
            </tr>

            <tr>
              <td>DEL-002</td>
              <td>Delivery</td>
              <td>Office Chairs</td>
              <td>-20</td>
              <td><span className="status ready">Ready</span></td>
            </tr>

            <tr>
              <td>TRF-003</td>
              <td>Internal</td>
              <td>Steel Rods</td>
              <td>20</td>
              <td><span className="status waiting">Waiting</span></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}

export default Dashboard;