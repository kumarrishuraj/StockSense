import { useState } from "react";

export default function ProductForm() {
  const [product, setProduct] = useState({
    name: "",
    sku: "",
    category: "",
    unit: "",
    initialStock: ""
  });

  const handleChange = (e) => {
    setProduct({
      ...product,
      [e.target.name]: e.target.value
    });
  };

  return (
    <form>
      <input name="name" placeholder="Product Name" onChange={handleChange} />
      <input name="sku" placeholder="SKU" onChange={handleChange} />
      <input name="category" placeholder="Category" onChange={handleChange} />
      <input name="unit" placeholder="Unit" onChange={handleChange} />
      <input name="initialStock" placeholder="Initial Stock" onChange={handleChange} />

      <button>Add Product</button>
    </form>
  );
}
