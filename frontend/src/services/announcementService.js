import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function getAnnouncements(token) {
  const res = await axios.get(`${API_BASE}/api/v1/announcements`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function createAnnouncement(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/announcements`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getRecentAnnouncements(token, limit = 5) {
  const res = await axios.get(`${API_BASE}/api/v1/owner/announcements/recent`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit },
  });
  return res.data;
}
