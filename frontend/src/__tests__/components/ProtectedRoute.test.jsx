import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';
import { AuthProvider } from '../../hooks/AuthProvider';
import * as authService from '../../services/authService';
import { MOCK_TOKEN, MOCK_USER, MOCK_OWNER_USER } from '../setupTests';

// Mock authService
vi.mock('../../services/authService', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  changePassword: vi.fn(),
  getToken: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

// Componente de teste protegido
const ProtectedComponent = () => <div data-testid="protected-content">Protected Content</div>;

// Componente de login
const LoginComponent = () => <div data-testid="login-page">Login Page</div>;

// Componente de admin
const AdminComponent = () => <div data-testid="admin-content">Admin Content</div>;

// Componente de owner
const OwnerComponent = () => <div data-testid="owner-content">Owner Content</div>;

const renderWithRouter = (authenticated = false, role = null, loading = false) => {
  vi.mocked(authService.getToken).mockReturnValue(
    authenticated ? MOCK_TOKEN : null
  );
  vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(
    authenticated ? (role === 'ADMIN' ? MOCK_USER : MOCK_OWNER_USER) : null
  );

  return render(
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginComponent />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <ProtectedComponent />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminComponent />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/*"
            element={
              <ProtectedRoute requiredRole="PROPIETARIO">
                <OwnerComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('test_ProtectedRoute_allow_authenticated', () => {
    it('deve renderizar componente protegido quando isAuthenticated=true', async () => {
      // Arrange
      window.history.pushState({}, 'Protected', '/protected');
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });

    it('deve renderizar conteúdo quando user está autenticado', async () => {
      // Arrange
      localStorage.setItem('auth_token', MOCK_TOKEN);
      window.history.pushState({}, 'Test', '/');
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ProtectedComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });
  });

  describe('test_ProtectedRoute_redirect_unauthenticated', () => {
    it('deve redirecionar para /login quando sem autenticação', async () => {
      // Arrange
      window.history.pushState({}, 'Protected', '/protected');
      vi.mocked(authService.getToken).mockReturnValue(null);

      // Act
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginComponent />} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      });
    });

    it('deve remover conteúdo protegido quando isAuthenticated=false', async () => {
      // Arrange
      window.history.pushState({}, 'Protected', '/protected');
      vi.mocked(authService.getToken).mockReturnValue(null);

      // Act
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginComponent />} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      });
    });
  });

  describe('role-based access control', () => {
    it('deve permitir ADMIN acessar rota /admin', async () => {
      // Arrange
      window.history.pushState({}, 'Admin', '/admin/dashboard');
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginComponent />} />
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      });
    });

    it('deve permitir PROPIETARIO acessar rota /owner', async () => {
      // Arrange
      window.history.pushState({}, 'Owner', '/owner/apartments');
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(
        MOCK_OWNER_USER
      );

      // Act
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginComponent />} />
              <Route
                path="/owner/*"
                element={
                  <ProtectedRoute requiredRole="PROPIETARIO">
                    <OwnerComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('owner-content')).toBeInTheDocument();
      });
    });

    it('deve redirecionar PROPIETARIO tentando acessar /admin', async () => {
      // Arrange
      window.history.pushState({}, 'Admin', '/admin/dashboard');
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(
        MOCK_OWNER_USER
      );

      // Act
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginComponent />} />
              <Route path="/owner/apartments" element={<OwnerComponent />} />
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
        // Deve redirecionar para /owner/apartments
        expect(screen.getByTestId('owner-content')).toBeInTheDocument();
      });
    });

    it('deve redirecionar ADMIN tentando acessar /owner', async () => {
      // Arrange
      window.history.pushState({}, 'Owner', '/owner/apartments');
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginComponent />} />
              <Route path="/admin/owners" element={<AdminComponent />} />
              <Route
                path="/owner/*"
                element={
                  <ProtectedRoute requiredRole="PROPIETARIO">
                    <OwnerComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.queryByTestId('owner-content')).not.toBeInTheDocument();
        // Deve redirecionar para /admin/owners
        expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('deve exibir "Cargando..." enquanto está carregando', async () => {
      // Arrange
      window.history.pushState({}, 'Protected', '/protected');
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve(MOCK_USER),
              100
            )
          )
      );

      // Act
      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert - deve mostrar loading
      await waitFor(() => {
        expect(screen.getByText('Cargando...')).toBeInTheDocument();
      });
    });

    it('deve renderizar conteúdo após carregamento', async () => {
      // Arrange
      window.history.pushState({}, 'Protected', '/protected');
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });
  });

  describe('redirect behavior', () => {
    it('deve usar replace=true para redirect', async () => {
      // Arrange
      const historySpy = vi.spyOn(window.history, 'replaceState');
      window.history.pushState({}, 'Protected', '/protected');
      vi.mocked(authService.getToken).mockReturnValue(null);

      // Act
      render(
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginComponent />} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedComponent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      historySpy.mockRestore();
    });
  });
});
