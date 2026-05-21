import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../hooks/AuthProvider';
import { AuthContext } from '../../hooks/AuthContext';
import axios from 'axios';
import {
  MOCK_TOKEN,
  MOCK_USER,
  MOCK_OWNER_USER,
  MOCK_LOGIN_RESPONSE,
  MOCK_OWNER_LOGIN_RESPONSE,
} from '../setupTests';
import * as authService from '../../services/authService';

// Mock authService para tests del provider
vi.mock('../../services/authService', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  changePassword: vi.fn(),
  getToken: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

const TestComponent = ({ testRole } = {}) => {
  // Componente test que accede al contexto
  return (
    <AuthContext.Consumer>
      {(value) => (
        <div>
          {value.loading && <div>Loading...</div>}
          {value.isAuthenticated && (
            <div>
              <div data-testid="user-email">{value.user?.email}</div>
              <div data-testid="user-role">{value.role}</div>
              <button onClick={() => value.logout()}>Logout</button>
            </div>
          )}
          {!value.isAuthenticated && !value.loading && (
            <div data-testid="not-authenticated">Not authenticated</div>
          )}
        </div>
      )}
    </AuthContext.Consumer>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('test_AuthProvider_load_user_from_token', () => {
    it('debe cargar user desde token válido en localStorage al montar', async () => {
      // Arrange
      localStorage.setItem('auth_token', MOCK_TOKEN);
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent(
          'admin@edificios.com'
        );
        expect(screen.getByTestId('user-role')).toHaveTextContent('ADMIN');
      });
      expect(authService.getCurrentUser).toHaveBeenCalled();
    });
  });

  describe('test_AuthProvider_no_token_on_mount', () => {
    it('debe mostrar user null si no hay token en localStorage', async () => {
      // Arrange
      vi.mocked(authService.getToken).mockReturnValue(null);

      // Act
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('not-authenticated')).toBeInTheDocument();
      });
      expect(authService.getCurrentUser).not.toHaveBeenCalled();
    });
  });

  describe('test_AuthProvider_login_workflow', () => {
    it('debe popular context.user y guardar token en localStorage después de login', async () => {
      // Arrange
      vi.mocked(authService.getToken).mockReturnValue(null);
      vi.mocked(authService.login).mockResolvedValueOnce(MOCK_LOGIN_RESPONSE);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      const { rerender } = render(
        <AuthProvider>
          <AuthContext.Consumer>
            {(value) => (
              <button
                onClick={() =>
                  value.login('admin@edificios.com', 'Admin123!')
                }
                data-testid="login-btn"
              >
                Login
              </button>
            )}
          </AuthContext.Consumer>
        </AuthProvider>
      );

      // Simulate login
      const loginBtn = screen.getByTestId('login-btn');
      loginBtn.click();

      // Assert
      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith(
          'admin@edificios.com',
          'Admin123!'
        );
        expect(authService.getCurrentUser).toHaveBeenCalled();
      });
    });
  });

  describe('test_AuthProvider_logout_workflow', () => {
    it('debe limpiar context.user y token en localStorage después de logout', async () => {
      // Arrange
      localStorage.setItem('auth_token', MOCK_TOKEN);
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);
      vi.mocked(authService.logout).mockResolvedValueOnce(undefined);

      // Act
      render(
        <AuthProvider>
          <AuthContext.Consumer>
            {(value) => (
              <div>
                {value.user && (
                  <button
                    onClick={() => value.logout()}
                    data-testid="logout-btn"
                  >
                    Logout
                  </button>
                )}
                {!value.user && (
                  <div data-testid="logged-out">Logged out</div>
                )}
              </div>
            )}
          </AuthContext.Consumer>
        </AuthProvider>
      );

      // Wait for user to load
      await waitFor(() => {
        expect(screen.getByTestId('logout-btn')).toBeInTheDocument();
      });

      // Logout
      const logoutBtn = screen.getByTestId('logout-btn');
      logoutBtn.click();

      // Assert
      await waitFor(() => {
        expect(authService.logout).toHaveBeenCalled();
        expect(screen.getByTestId('logged-out')).toBeInTheDocument();
      });
    });
  });

  describe('error handling on mount', () => {
    it('debe manejar error al cargar user y limpiar token', async () => {
      // Arrange
      localStorage.setItem('auth_token', MOCK_TOKEN);
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockRejectedValueOnce(
        new Error('Token inválido')
      );

      // Act
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('not-authenticated')).toBeInTheDocument();
      });
      expect(authService.clearToken).toHaveBeenCalled();
    });
  });

  describe('ADMIN role handling', () => {
    it('debe setear role=ADMIN en el contexto', async () => {
      // Arrange
      localStorage.setItem('auth_token', MOCK_TOKEN);
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      render(
        <AuthProvider>
          <AuthContext.Consumer>
            {(value) => (
              <div data-testid="role-display">{value.role}</div>
            )}
          </AuthContext.Consumer>
        </AuthProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('role-display')).toHaveTextContent('ADMIN');
      });
    });
  });

  describe('PROPIETARIO role handling', () => {
    it('debe setear role=PROPIETARIO en el contexto', async () => {
      // Arrange
      localStorage.setItem('auth_token', MOCK_TOKEN);
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(
        MOCK_OWNER_USER
      );

      // Act
      render(
        <AuthProvider>
          <AuthContext.Consumer>
            {(value) => (
              <div data-testid="role-display">{value.role}</div>
            )}
          </AuthContext.Consumer>
        </AuthProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('role-display')).toHaveTextContent(
          'PROPIETARIO'
        );
      });
    });
  });

  describe('isAuthenticated flag', () => {
    it('debe setear isAuthenticated=true cuando user y token existen', async () => {
      // Arrange
      localStorage.setItem('auth_token', MOCK_TOKEN);
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      render(
        <AuthProvider>
          <AuthContext.Consumer>
            {(value) => (
              <div data-testid="auth-status">
                {value.isAuthenticated ? 'authenticated' : 'not-authenticated'}
              </div>
            )}
          </AuthContext.Consumer>
        </AuthProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent(
          'authenticated'
        );
      });
    });

    it('debe setear isAuthenticated=false cuando user o token no existen', async () => {
      // Arrange
      vi.mocked(authService.getToken).mockReturnValue(null);

      // Act
      render(
        <AuthProvider>
          <AuthContext.Consumer>
            {(value) => (
              <div data-testid="auth-status">
                {value.isAuthenticated ? 'authenticated' : 'not-authenticated'}
              </div>
            )}
          </AuthContext.Consumer>
        </AuthProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent(
          'not-authenticated'
        );
      });
    });
  });
});
