import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function createFee(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/apartment-fees`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function bulkUploadFees(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/apartment-fees/bulk`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getFeesByPeriod(token, period) {
  const res = await axios.get(`${API_BASE}/api/v1/apartment-fees`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { period },
  });
  return res.data;
}
