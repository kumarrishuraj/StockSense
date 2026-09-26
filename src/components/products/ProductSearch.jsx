import { useState } from "react";

export default function ProductSearch({ products }) {
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <input
        placeholder="Search SKU or product..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.map((p) => (
        <p key={p.sku}>
          {p.name} — {p.sku}
        </p>
      ))}
    </div>
  );
}
