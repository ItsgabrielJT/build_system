import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function getApartments(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/apartments`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function getApartment(token, apartmentId) {
  const res = await axios.get(`${API_BASE}/api/v1/apartments/${apartmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function createApartment(data, token) {
  const res = await axios.post(`${API_BASE}/api/v1/apartments`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateApartment(apartmentId, data, token) {
  const res = await axios.put(`${API_BASE}/api/v1/apartments/${apartmentId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function assignOwner(apartmentId, ownerId, data, token) {
  const res = await axios.post(
    `${API_BASE}/api/v1/apartments/${apartmentId}/owners/${ownerId}`,
    data,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

export async function removeOwner(apartmentId, ownerId, token) {
  await axios.delete(
    `${API_BASE}/api/v1/apartments/${apartmentId}/owners/${ownerId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}
