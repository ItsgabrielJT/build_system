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

export async function getOwnerDirectory(token, params = {}) {
  const res = await axios.get(`${API_BASE}/api/v1/owners/directory`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function getOwnerProfile(token) {
  const res = await axios.get(`${API_BASE}/api/v1/owners/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getOwnerProfileDetail(token) {
  const res = await axios.get(`${API_BASE}/api/v1/owner/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateOwnerProfileDetail(data, token) {
  const res = await axios.put(`${API_BASE}/api/v1/owner/profile`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function downloadOwnerFicha(token) {
  const res = await axios.get(`${API_BASE}/api/v1/owner/ficha`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  return res.data;
}

export async function uploadOwnerProfilePhoto(file, token) {
  const formData = new FormData();
  formData.append('photo_file', file);
  const res = await axios.put(`${API_BASE}/api/v1/owner/profile/photo`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function getOwnerProfilePhotoBlob(ownerId, token) {
  const res = await axios.get(`${API_BASE}/api/v1/owners/${ownerId}/assets/photo`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  return res.data;
}



