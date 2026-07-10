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

export async function getBuildingConfig(token) {
  const res = await axios.get(`${API_BASE}/api/v1/buildings/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateBuildingConfig(data, token) {
  const configData = new FormData();
  configData.append('name', data.name || '');
  configData.append('address', data.address || '');
  configData.append('phone', data.phone || '');
  configData.append('email', data.email || '');
  if (data.photo_file) configData.append('photo_file', data.photo_file);
  if (data.logo_file) configData.append('logo_file', data.logo_file);
  if (data.signature_file) configData.append('signature_file', data.signature_file);
  if (data.seal_file) configData.append('seal_file', data.seal_file);
  if (data.regulation_file) configData.append('regulation_file', data.regulation_file);

  const res = await axios.put(`${API_BASE}/api/v1/buildings/config`, configData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateBuilding(buildingId, data, token) {
  const {
    photo_file,
    logo_file,
    signature_file,
    seal_file,
    regulation_file,
    ...buildingData
  } = data;
  let res = await axios.put(`${API_BASE}/api/v1/buildings/${buildingId}`, buildingData, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (photo_file || logo_file || signature_file || seal_file || regulation_file) {
    const assetData = new FormData();
    if (photo_file) assetData.append('photo_file', photo_file);
    if (logo_file) assetData.append('logo_file', logo_file);
    if (signature_file) assetData.append('signature_file', signature_file);
    if (seal_file) assetData.append('seal_file', seal_file);
    if (regulation_file) assetData.append('regulation_file', regulation_file);

    res = await axios.put(`${API_BASE}/api/v1/buildings/${buildingId}/assets`, assetData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return res.data;
}

export function getBuildingAssetUrl(buildingId, assetType) {
  return `${API_BASE}/api/v1/buildings/${buildingId}/assets/${assetType}`;
}

export async function getBuildingAssetBlob(buildingId, assetType, token) {
  const res = await axios.get(getBuildingAssetUrl(buildingId, assetType), {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  return res.data;
}
