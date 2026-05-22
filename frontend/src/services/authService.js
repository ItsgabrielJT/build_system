import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'auth_token';
let memoryToken = null;

function getStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Login con credenciales locales
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{access_token: string, token_type: string, user: object}>}
 */
export async function login(email, password) {
  try {
    const response = await axios.post(`${API_BASE}/api/v1/auth/login`, {
      email,
      password,
    });
    const { access_token } = response.data;
    setToken(access_token);
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Credenciales inválidas');
    }
    throw error;
  }
}

/**
 * Solicitar recuperación de contraseña
 * @param {string} email
 * @returns {Promise<{message: string}>}
 */
export async function requestPasswordRecovery(email) {
  try {
    const response = await axios.post(`${API_BASE}/api/v1/auth/forgot-password`, {
      email,
    });
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) {
      throw new Error('Ingresa un correo válido para continuar');
    }
    throw error;
  }
}

/**
 * Logout - limpia el token del localStorage
 * @returns {Promise<void>}
 */
export async function logout() {
  const token = getToken();
  try {
    await axios.post(
      `${API_BASE}/api/v1/auth/logout`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    console.error('Error en logout:', error);
  } finally {
    clearToken();
  }
}

/**
 * Obtener usuario actual autenticado
 * @returns {Promise<object>}
 */
export async function getCurrentUser() {
  const token = getToken();
  if (!token) {
    throw new Error('No token found');
  }
  try {
    const response = await axios.get(`${API_BASE}/api/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      clearToken();
    }
    throw error;
  }
}

/**
 * Cambiar contraseña del usuario
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<object>}
 */
export async function changePassword(currentPassword, newPassword) {
  const token = getToken();
  if (!token) {
    throw new Error('No token found');
  }
  try {
    const response = await axios.post(
      `${API_BASE}/api/v1/users/me/change-password`,
      {
        current_password: currentPassword,
        new_password: newPassword,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      clearToken();
    }
    throw error;
  }
}

/**
 * Obtener token del localStorage
 * @returns {string|null}
 */
export function getToken() {
  const storage = getStorage();
  return storage ? storage.getItem(TOKEN_KEY) : memoryToken;
}

/**
 * Guardar token en localStorage
 * @param {string} token
 */
export function setToken(token) {
  const storage = getStorage();
  if (token) {
    memoryToken = token;
    storage?.setItem(TOKEN_KEY, token);
  } else {
    memoryToken = null;
    storage?.removeItem(TOKEN_KEY);
  }
}

/**
 * Limpiar token del localStorage
 */
export function clearToken() {
  memoryToken = null;
  getStorage()?.removeItem(TOKEN_KEY);
}
