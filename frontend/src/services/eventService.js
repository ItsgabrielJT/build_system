import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function getEvents(token) {
  const res = await axios.get(`${API_BASE}/api/v1/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function createEvent(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/events`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getMyEvents(token) {
  const res = await axios.get(`${API_BASE}/api/v1/owner/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
