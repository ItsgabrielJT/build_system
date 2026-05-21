import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function createPayment(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/payments`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getPayments(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/payments`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function annulPayment(paymentId, token) {
  const res = await axios.put(
    `${API_BASE}/api/v1/payments/${paymentId}`,
    { status: 'ANULADO' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}
