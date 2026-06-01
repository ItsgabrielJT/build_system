import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function getAdminPaymentNotifications(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/admin/notifications/payments`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function getOwnerPaymentNotifications(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/owner/notifications/payments`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}