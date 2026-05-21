import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function createExpense(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/expenses`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getExpensesByMonth(token, month) {
  const res = await axios.get(`${API_BASE}/api/v1/expenses`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { month },
  });
  return res.data;
}
