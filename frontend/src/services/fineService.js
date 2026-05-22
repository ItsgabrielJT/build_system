import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function createFine(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/fines`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getFines(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/fines`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function getFineStats(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/fines/stats`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function annulFine(fineId, token) {
  const res = await axios.put(
    `${API_BASE}/api/v1/fines/${fineId}`,
    { status: 'ANULADA' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}
