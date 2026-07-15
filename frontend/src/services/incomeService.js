import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function getIncomes(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/incomes`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function createIncome(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/incomes`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function annulIncome(incomeId, token) {
  const res = await axios.put(
    `${API_BASE}/api/v1/incomes/${incomeId}`,
    { status: 'ANULADO' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

export async function deleteIncome(incomeId, token) {
  const res = await axios.delete(`${API_BASE}/api/v1/incomes/${incomeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
