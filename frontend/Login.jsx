import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = (e) => {
    e.preventDefault();
    console.log("Login:", email);
  };

  return (
    <div>
      <h1>StockSense</h1>
      <h2>Login</h2>

      <form onSubmit={login}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button>Login</button>
      </form>
    </div>
  );
}