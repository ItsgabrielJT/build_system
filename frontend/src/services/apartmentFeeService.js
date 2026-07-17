import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function createFee(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/apartment-fees`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateFee(feeId, data, token) {
  const res = await axios.put(`${API_BASE}/api/v1/apartment-fees/${feeId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function bulkUploadFees(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/apartment-fees/bulk`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getFeesByPeriod(token, period) {
  const res = await axios.get(`${API_BASE}/api/v1/apartment-fees`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { period },
  });
  return res.data;
}

export async function getApartmentFeeStats(period, token) {
  const params = period ? { period } : {};
  const res = await axios.get(`${API_BASE}/api/v1/apartment-fees/stats`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function getPeriodsSummary(page = 1, pageSize = 10, year = null, token) {
  const params = { page, page_size: pageSize };
  if (year) params.year = year;
  const res = await axios.get(`${API_BASE}/api/v1/apartment-fees/periods-summary`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function deleteFee(feeId, token) {
  const res = await axios.delete(`${API_BASE}/api/v1/apartment-fees/${feeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function bulkDeleteFees(feeIds, token) {
  const res = await axios.post(`${API_BASE}/api/v1/apartment-fees/bulk-delete`, { fee_ids: feeIds }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
