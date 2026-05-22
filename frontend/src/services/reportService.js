import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function getDashboardStats(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/reports/dashboard-stats`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function downloadDelinquencyReport(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/reports/delinquency`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    responseType: 'blob',
  });
  return res.data;
}

export async function downloadIncomeReport(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/reports/income`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    responseType: 'blob',
  });
  return res.data;
}

export async function downloadBalanceReport(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/reports/balance`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    responseType: 'blob',
  });
  return res.data;
}
