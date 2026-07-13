import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function validatePdfDocument(token) {
  const response = await axios.get(`${API_BASE}/api/v1/public/pdf-validation/${encodeURIComponent(token)}`);
  return response.data;
}

export function getPublicBuildingLogoUrl(buildingId) {
  if (!buildingId) return null;
  return `${API_BASE}/api/v1/public/pdf-validation/building-logo/${buildingId}`;
}
