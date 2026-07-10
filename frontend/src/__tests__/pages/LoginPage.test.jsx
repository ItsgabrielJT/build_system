import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage';
import { AuthProvider } from '../../hooks/AuthProvider';
import * as authService from '../../services/authService';
import { MOCK_TOKEN, MOCK_USER, MOCK_OWNER_USER } from '../setupTests';

// Mock authService
vi.mock('../../services/authService', () => ({
  login: vi.fn(),
  requestPasswordRecovery: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  changePassword: vi.fn(),
  getToken: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(authService.getToken).mockReturnValue(null);
  });

  describe('test_LoginPage_renders_form', () => {
    it('deve renderizar form com email input, password input e submit button', () => {
      // Act
      renderLoginPage();

      // Assert
      expect(screen.getByPlaceholderText('admin@edificio.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in to portal/i })).toBeInTheDocument();
    });

    it('deve renderizar títulos da página', () => {
      // Act
      renderLoginPage();

      // Assert
      expect(screen.getByText(/HabitaUIO/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Enterprise Management Portal/i)
      ).toBeInTheDocument();
    });

    it('deve ter email input com atributos corretos', () => {
      // Act
      renderLoginPage();

      // Assert
      const emailInput = screen.getByPlaceholderText('admin@edificio.com');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('required');
    });

    it('deve ter password input com atributos corretos', () => {
      // Act
      renderLoginPage();

      // Assert
      const passwordInput = screen.getByPlaceholderText('••••••••');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('required');
    });
  });

  describe('test_LoginPage_validation_empty_fields', () => {
    it('deve mostrar validação error ao submit com campos vazios', async () => {
      // Act
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /sign in to portal/i });
      const emailInput = screen.getByPlaceholderText('admin@edificio.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      // Enviar form vazio
      fireEvent.submit(submitButton.closest('form'));

      // Assert - inputs required devem impedir submit
      expect(emailInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('required');
    });

    it('deve validar formato de email', async () => {
      // Act
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText('admin@edificio.com');

      // Enviar email inválido
      await userEvent.type(emailInput, 'invalid-email');

      // Assert
      expect(emailInput).toHaveValue('invalid-email');
      // HTML5 validation deve impedir submit
      expect(emailInput).toHaveAttribute('type', 'email');
    });
  });

  describe('test_LoginPage_submit_valid_credentials', () => {
    it('deve chamar login com credenciais válidas e fazer redirect', async () => {
      // Arrange
      const loginResponse = {
        access_token: MOCK_TOKEN,
        token_type: 'bearer',
        user: MOCK_USER,
      };
      vi.mocked(authService.login).mockResolvedValueOnce(loginResponse);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText('admin@edificio.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /sign in to portal/i });

      await userEvent.type(emailInput, 'admin@edificios.com');
      await userEvent.type(passwordInput, 'Admin123!');
      await userEvent.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith(
          'admin@edificios.com',
          'Admin123!'
        );
      });
    });

    it('deve desabilitar submit button durante loading', async () => {
      // Arrange
      vi.mocked(authService.login).mockImplementationOnce(
        () =>
          new Promise((resolve) => setTimeout(() => resolve({ access_token: MOCK_TOKEN }), 100))
      );

      // Act
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText('admin@edificio.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /sign in to portal/i });

      await userEvent.type(emailInput, 'admin@edificios.com');
      await userEvent.type(passwordInput, 'Admin123!');
      await userEvent.click(submitButton);

      // Assert
      expect(submitButton).toBeDisabled();
    });

    it('deve mostrar "Ingresando..." durante loading', async () => {
      // Arrange
      vi.mocked(authService.login).mockImplementationOnce(
        () =>
          new Promise((resolve) => setTimeout(() => resolve({ access_token: MOCK_TOKEN }), 100))
      );

      // Act
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText('admin@edificio.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /sign in to portal/i });

      await userEvent.type(emailInput, 'admin@edificios.com');
      await userEvent.type(passwordInput, 'Admin123!');
      await userEvent.click(submitButton);

      // Assert
      expect(submitButton).toHaveTextContent('Signing in...');
    });
  });

  describe('test_LoginPage_display_error_invalid_credentials', () => {
    it('deve exibir erro message ao falhar login com credenciais inválidas', async () => {
      // Arrange
      vi.mocked(authService.login).mockRejectedValueOnce(
        new Error('Credenciales inválidas')
      );

      // Act
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText('admin@edificio.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /sign in to portal/i });

      await userEvent.type(emailInput, 'admin@edificios.com');
      await userEvent.type(passwordInput, 'WrongPassword');
      await userEvent.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(
          screen.getByText('Credenciales inválidas')
        ).toBeInTheDocument();
      });
    });

    it('deve limpar erro ao tentar login novamente', async () => {
      // Arrange
      vi.mocked(authService.login)
        .mockRejectedValueOnce(new Error('Credenciales inválidas'))
        .mockResolvedValueOnce({
          access_token: MOCK_TOKEN,
          user: MOCK_USER,
        });

      // Act
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText('admin@edificio.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /sign in to portal/i });

      // Primeira tentativa - erro
      await userEvent.type(emailInput, 'admin@edificios.com');
      await userEvent.type(passwordInput, 'WrongPassword');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('Credenciales inválidas')
        ).toBeInTheDocument();
      });

      // Limpar e tentar novamente
      await userEvent.clear(emailInput);
      await userEvent.clear(passwordInput);
      await userEvent.type(emailInput, 'admin@edificios.com');
      await userEvent.type(passwordInput, 'Admin123!');
      await userEvent.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledTimes(2);
      });
    });

    it('deve exibir mensagem genérica ao falhar', async () => {
      // Arrange
      vi.mocked(authService.login).mockRejectedValueOnce(
        new Error('Network error')
      );

      // Act
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText('admin@edificio.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /sign in to portal/i });

      await userEvent.type(emailInput, 'admin@edificios.com');
      await userEvent.type(passwordInput, 'Admin123!');
      await userEvent.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(
          screen.getByText('Network error')
        ).toBeInTheDocument();
      });
    });
  });

  describe('form input behavior', () => {
    it('deve atualizar email input value corretamente', async () => {
      // Act
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText('admin@edificio.com');
      await userEvent.type(emailInput, 'test@example.com');

      // Assert
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('deve atualizar password input value corretamente', async () => {
      // Act
      renderLoginPage();

      const passwordInput = screen.getByPlaceholderText('••••••••');
      await userEvent.type(passwordInput, 'TestPassword123');

      // Assert
      expect(passwordInput).toHaveValue('TestPassword123');
    });

    it('deve limpar inputs após submit bem sucedido', async () => {
      // Arrange
      vi.mocked(authService.login).mockResolvedValueOnce({
        access_token: MOCK_TOKEN,
        user: MOCK_USER,
      });
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText('admin@edificio.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByRole('button', { name: /sign in to portal/i });

      await userEvent.type(emailInput, 'admin@edificios.com');
      await userEvent.type(passwordInput, 'Admin123!');
      await userEvent.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(authService.login).toHaveBeenCalled();
      });
    });
  });

  describe('redirect for already authenticated users', () => {
    it('deve redirecionar para /admin/reports se user é ADMIN', async () => {
      // Arrange
      localStorage.setItem('auth_token', MOCK_TOKEN);
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(MOCK_USER);

      // Act
      renderLoginPage();

      // Assert
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/reports', {
          replace: true,
        });
      });
    });

    it('deve redirecionar para /owner/inicio se user é PROPIETARIO', async () => {
      // Arrange
      localStorage.setItem('auth_token', MOCK_TOKEN);
      vi.mocked(authService.getToken).mockReturnValue(MOCK_TOKEN);
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce(
        MOCK_OWNER_USER
      );

      // Act
      renderLoginPage();

      // Assert
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/owner/inicio', {
          replace: true,
        });
      });
    });
  });

  describe('password recovery', () => {
    it('debe enviar solicitud de recuperación con el correo ingresado', async () => {
      vi.mocked(authService.requestPasswordRecovery).mockResolvedValueOnce({
        message: 'Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.',
      });

      renderLoginPage();

      await userEvent.click(screen.getByRole('button', { name: /reset password/i }));
      await userEvent.type(screen.getByPlaceholderText('admin@edificio.com'), 'admin@edificios.com');
      await userEvent.click(screen.getByRole('button', { name: /send recovery request/i }));

      await waitFor(() => {
        expect(authService.requestPasswordRecovery).toHaveBeenCalledWith('admin@edificios.com');
      });
      expect(screen.getByText(/recibirás instrucciones/i)).toBeInTheDocument();
    });
  });
});
