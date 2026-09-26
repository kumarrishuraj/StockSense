export default function Adjustments() {
  return (
    <div>
      <h1>Inventory Adjustment</h1>

      <input placeholder="Product" />

      <input placeholder="Location" />

      <input
        type="number"
        placeholder="Counted Quantity"
      />

      <button>Apply Adjustment</button>
    </div>
  );
}