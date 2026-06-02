import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function getUsers(token, role = null) {
  const params = role ? { role } : {};
  const res = await axios.get(`${API_BASE}/api/v1/users`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function createUser(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/users`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateUser(userId, data, token) {
  const res = await axios.put(`${API_BASE}/api/v1/users/${userId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getRoles(token) {
  const res = await axios.get(`${API_BASE}/api/v1/users/roles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
