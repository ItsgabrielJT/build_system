import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import {
  login,
  logout,
  getCurrentUser,
  changePassword,
  getToken,
  setToken,
  clearToken,
} from '../../services/authService';
import {
  MOCK_TOKEN,
  MOCK_USER,
  MOCK_LOGIN_RESPONSE,
} from '../setupTests';

describe('authService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('login()', () => {
    it('test_authService_login_success: debe retornar token y user, y guardar en localStorage', async () => {
      // Arrange
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: MOCK_LOGIN_RESPONSE,
      });

      // Act
      const result = await login('admin@edificios.com', 'Admin123!');

      // Assert
      expect(result).toEqual(MOCK_LOGIN_RESPONSE);
      expect(result.access_token).toBe(MOCK_TOKEN);
      expect(result.user).toEqual(MOCK_USER);
      expect(localStorage.getItem('auth_token')).toBe(MOCK_TOKEN);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/login'),
        {
          email: 'admin@edificios.com',
          password: 'Admin123!',
        }
      );
    });

    it('test_authService_login_invalid_credentials: debe lanzar error 401', async () => {
      // Arrange
      vi.mocked(axios.post).mockRejectedValueOnce({
        response: {
          status: 401,
          data: { detail: 'Credenciales inválidas' },
        },
      });

      // Act & Assert
      await expect(
        login('admin@edificios.com', 'WrongPassword')
      ).rejects.toThrow('Credenciales inválidas');
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('debe manejar errores de red', async () => {
      // Arrange
      vi.mocked(axios.post).mockRejectedValueOnce({
        message: 'Network Error',
      });

      // Act & Assert
      await expect(login('admin@edificios.com', 'Admin123!')).rejects.toThrow();
    });

    it('debe validar email requerido', async () => {
      // Arrange
      vi.mocked(axios.post).mockRejectedValueOnce({
        response: {
          status: 400,
          data: { detail: 'Email es requerido' },
        },
      });

      // Act & Assert
      await expect(login('', 'Admin123!')).rejects.toThrow();
    });
  });

  describe('logout()', () => {
    it('test_authService_logout: debe limpiar localStorage incluso si hay error', async () => {
      // Arrange
      setToken(MOCK_TOKEN);
      vi.mocked(axios.post).mockResolvedValueOnce({ data: { message: 'OK' } });

      // Act
      await logout();

      // Assert
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/logout'),
        {},
        {
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        }
      );
    });

    it('debe limpiar token incluso si hay error en el servidor', async () => {
      // Arrange
      setToken(MOCK_TOKEN);
      vi.mocked(axios.post).mockRejectedValueOnce({
        response: { status: 500 },
      });

      // Act
      await logout();

      // Assert
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('debe manejar logout sin token', async () => {
      // Arrange - no token set

      // Act
      await logout();

      // Assert
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('getCurrentUser()', () => {
    it('debe retornar el usuario actual autenticado', async () => {
      // Arrange
      setToken(MOCK_TOKEN);
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: MOCK_USER,
      });

      // Act
      const user = await getCurrentUser();

      // Assert
      expect(user).toEqual(MOCK_USER);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/me'),
        {
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        }
      );
    });

    it('debe lanzar error si no hay token', async () => {
      // Arrange - no token

      // Act & Assert
      await expect(getCurrentUser()).rejects.toThrow('No token found');
    });

    it('debe remover token si retorna 401', async () => {
      // Arrange
      setToken(MOCK_TOKEN);
      vi.mocked(axios.get).mockRejectedValueOnce({
        response: {
          status: 401,
          data: { detail: 'Token inválido' },
        },
      });

      // Act & Assert
      await expect(getCurrentUser()).rejects.toThrow();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('changePassword()', () => {
    it('test_authService_changePassword_success: debe cambiar contraseña exitosamente', async () => {
      // Arrange
      setToken(MOCK_TOKEN);
      const response = { message: 'Contraseña actualizada' };
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: response,
      });

      // Act
      const result = await changePassword('OldPass123', 'NewPass456');

      // Assert
      expect(result).toEqual(response);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/me/change-password'),
        {
          current_password: 'OldPass123',
          new_password: 'NewPass456',
        },
        {
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        }
      );
    });

    it('test_authService_changePassword_wrong_current: debe lanzar error 401 si contraseña actual es incorrecta', async () => {
      // Arrange
      setToken(MOCK_TOKEN);
      vi.mocked(axios.post).mockRejectedValueOnce({
        response: {
          status: 401,
          data: { detail: 'Contraseña actual incorrecta' },
        },
      });

      // Act & Assert
      await expect(
        changePassword('WrongOldPass', 'NewPass456')
      ).rejects.toThrow();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('debe lanzar error si no hay token', async () => {
      // Arrange - no token

      // Act & Assert
      await expect(changePassword('OldPass123', 'NewPass456')).rejects.toThrow(
        'No token found'
      );
    });
  });

  describe('getToken()', () => {
    it('test_authService_getToken: debe retornar token desde localStorage', () => {
      // Arrange
      setToken(MOCK_TOKEN);

      // Act
      const token = getToken();

      // Assert
      expect(token).toBe(MOCK_TOKEN);
    });

    it('debe retornar null si no hay token', () => {
      // Arrange - no token

      // Act
      const token = getToken();

      // Assert
      expect(token).toBeNull();
    });
  });

  describe('setToken()', () => {
    it('debe guardar token en localStorage', () => {
      // Arrange & Act
      setToken(MOCK_TOKEN);

      // Assert
      expect(localStorage.getItem('auth_token')).toBe(MOCK_TOKEN);
    });

    it('debe remover token si se pasa null', () => {
      // Arrange
      setToken(MOCK_TOKEN);

      // Act
      setToken(null);

      // Assert
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('clearToken()', () => {
    it('debe limpiar token de localStorage', () => {
      // Arrange
      setToken(MOCK_TOKEN);

      // Act
      clearToken();

      // Assert
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('debe no fallar si no hay token', () => {
      // Arrange - no token

      // Act & Assert
      expect(() => clearToken()).not.toThrow();
    });
  });
});
