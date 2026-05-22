import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export async function getBuildings(token) {
  const res = await axios.get(`${API_BASE}/api/v1/buildings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getBuilding(token, buildingId) {
  const res = await axios.get(`${API_BASE}/api/v1/buildings/${buildingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateBuilding(buildingId, data, token) {
  const res = await axios.put(`${API_BASE}/api/v1/buildings/${buildingId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
