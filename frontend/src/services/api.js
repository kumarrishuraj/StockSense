const API_URL = "http://localhost:8000";

export async function getProducts() {
  const response = await fetch(`${API_URL}/products`);
  return response.json();
}

export async function getDashboardStats() {
  const response = await fetch(`${API_URL}/dashboard/stats`);
  return response.json();
}