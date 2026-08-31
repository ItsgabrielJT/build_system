import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function createOtherCharge(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/other-charges`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateOtherCharge(chargeId, data, token) {
  const res = await axios.put(`${API_BASE}/api/v1/other-charges/${chargeId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function bulkUploadOtherCharges(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/other-charges/bulk`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getOtherChargesByPeriod(token, period, periodicity = '') {
  const params = { period };
  if (periodicity) params.periodicity = periodicity;
  const res = await axios.get(`${API_BASE}/api/v1/other-charges`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function getOtherChargeStats(period, token) {
  const params = period ? { period } : {};
  const res = await axios.get(`${API_BASE}/api/v1/other-charges/stats`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function getOtherChargePeriodsSummary(page = 1, pageSize = 10, year = null, token) {
  const params = { page, page_size: pageSize };
  if (year) params.year = year;
  const res = await axios.get(`${API_BASE}/api/v1/other-charges/periods-summary`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function deleteOtherCharge(chargeId, token) {
  const res = await axios.delete(`${API_BASE}/api/v1/other-charges/${chargeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function bulkDeleteOtherCharges(chargeIds, token) {
  const res = await axios.post(`${API_BASE}/api/v1/other-charges/bulk-delete`, { charge_ids: chargeIds }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
