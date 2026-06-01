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

// SPEC-008: Owner payment flow
export async function submitOwnerPayment(formData, token) {
  const res = await axios.post(`${API_BASE}/api/v1/owner/payments`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function getOwnerPayments(filters = {}, token) {
  const res = await axios.get(`${API_BASE}/api/v1/owner/payments`, {
    headers: { Authorization: `Bearer ${token}` },
    params: filters,
  });
  return res.data;
}

export async function downloadPaymentAcknowledgement(paymentId, token) {
  const res = await axios.get(
    `${API_BASE}/api/v1/owner/payments/${paymentId}/acknowledgement`,
    { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
  );
  return res.data;
}

export async function downloadPaymentReceipt(paymentId, token) {
  const res = await axios.get(
    `${API_BASE}/api/v1/owner/payments/${paymentId}/receipt`,
    { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
  );
  return res.data;
}

// SPEC-008: Admin payment review flow
export async function getPendingPayments(token) {
  const res = await axios.get(`${API_BASE}/api/v1/admin/payments/pending`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function approvePayment(paymentId, token) {
  const res = await axios.put(
    `${API_BASE}/api/v1/admin/payments/${paymentId}/approve`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

export async function rejectPayment(paymentId, payload, token) {
  const res = await axios.put(
    `${API_BASE}/api/v1/admin/payments/${paymentId}/reject`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}
