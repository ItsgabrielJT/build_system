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

export async function getMonthlyStats(token, month) {
  const res = await axios.get(`${API_BASE}/api/v1/expenses/stats/monthly`, {
    headers: { Authorization: `Bearer ${token}` },
    params: month ? { month } : {},
  });
  return res.data;
}

export async function getChartData(token) {
  const res = await axios.get(`${API_BASE}/api/v1/expenses/stats/chart`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getRecentExpenses(token, limit = 10) {
  const res = await axios.get(`${API_BASE}/api/v1/expenses/recent`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit },
  });
  return res.data;
}
