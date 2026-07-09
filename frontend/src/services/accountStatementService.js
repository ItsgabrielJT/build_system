import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function getAccountStatement(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/account-statement`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function exportAccountStatement(token, format, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/account-statement/export`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { format, ...params },
    responseType: 'blob',
  });
  return res.data;
}

export async function exportExpenseCertificate(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/account-statement/expense-certificate`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    responseType: 'blob',
  });
  return res.data;
}
