import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function getOwners(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/owners`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function getOwner(token, ownerId) {
  const res = await axios.get(`${API_BASE}/api/v1/owners/${ownerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function createOwner(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/owners`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateOwner(ownerId, data, token) {
  const res = await axios.put(`${API_BASE}/api/v1/owners/${ownerId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function deleteOwner(ownerId, token) {
  await axios.delete(`${API_BASE}/api/v1/owners/${ownerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
