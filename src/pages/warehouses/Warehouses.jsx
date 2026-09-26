const warehouses = [
  {
    name: "Main Warehouse",
    location: "Building A"
  },
  {
    name: "Production Warehouse",
    location: "Building B"
  }
];

export default function Warehouses() {
  return (
    <div>
      <h1>Warehouses</h1>

      {warehouses.map((warehouse) => (
        <div key={warehouse.name}>
          <h3>{warehouse.name}</h3>
          <p>{warehouse.location}</p>
        </div>
      ))}
    </div>
  );
}