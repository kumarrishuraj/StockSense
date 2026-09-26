export default function FilterBar() {
  return (
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
        <option>Production Warehouse</option>
      </select>

      <select>
        <option>All Categories</option>
        <option>Raw Material</option>
        <option>Finished Goods</option>
      </select>

    </div>
  );
}