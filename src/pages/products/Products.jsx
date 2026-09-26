const products = [
  {
    name: "Steel Rods",
    sku: "SR-001",
    category: "Raw Material",
    stock: 500
  },
  {
    name: "Office Chair",
    sku: "CH-001",
    category: "Furniture",
    stock: 80
  }
];

export default function Products() {
  return (
    <div>
      <h1>Products</h1>

      <button>+ Add Product</button>

      {products.map((product) => (
        <div key={product.sku}>
          <h3>{product.name}</h3>
          <p>SKU: {product.sku}</p>
          <p>Category: {product.category}</p>
          <p>Stock: {product.stock}</p>
        </div>
      ))}
    </div>
  );
}