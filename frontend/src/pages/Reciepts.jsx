import { useState } from "react";

export default function Receipts() {
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");

  const submitReceipt = (e) => {
    e.preventDefault();

    console.log({
      type: "RECEIPT",
      product,
      quantity
    });
  };

  return (
    <div>
      <h1>New Receipt</h1>

      <form onSubmit={submitReceipt}>
        <input
          placeholder="Product"
          onChange={(e) => setProduct(e.target.value)}
        />

        <input
          type="number"
          placeholder="Quantity"
          onChange={(e) => setQuantity(e.target.value)}
        />

        <button>Validate Receipt</button>
      </form>
    </div>
  );
}