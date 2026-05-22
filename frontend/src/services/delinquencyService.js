import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function getDelinquentOwners(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/delinquency`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function getOwnerDelinquencyDetail(token, ownerId) {
  const res = await axios.get(`${API_BASE}/api/v1/delinquency/detail/${ownerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getDelinquencyStats(token) {
  const res = await axios.get(`${API_BASE}/api/v1/delinquency/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
