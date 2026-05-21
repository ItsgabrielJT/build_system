import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminReportsPage from '../../pages/admin/AdminReportsPage';
import * as reportService from '../../services/reportService';

vi.mock('../../services/reportService');
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'user1' },
    role: 'ADMIN',
  }),
}));

describe('AdminReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza tarjetas de reportes con botones de descarga', () => {
    render(<AdminReportsPage />);

    // Verificar que existen los reportes
    expect(screen.getByText('Reporte de Morosidad')).toBeInTheDocument();
    expect(screen.getByText('Reporte de Ingresos')).toBeInTheDocument();
    expect(screen.getByText('Balance Ingresos / Egresos')).toBeInTheDocument();

    // Verificar que existen botones de descarga
    const pdfButtons = screen.getAllByRole('button', { name: /Descargar PDF/i });
    const excelButtons = screen.getAllByRole('button', { name: /Descargar Excel/i });

    expect(pdfButtons.length).toBeGreaterThan(0);
    expect(excelButtons.length).toBeGreaterThan(0);
  });

  it('descarga reporte de morosidad en PDF', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['test'], { type: 'application/pdf' });
    reportService.downloadDelinquencyReport.mockResolvedValue(blob);

    render(<AdminReportsPage />);

    // Buscar el botón de descargar PDF para morosidad
    const pdfButtons = screen.getAllByRole('button', { name: /Descargar PDF/i });
    await user.click(pdfButtons[0]); // Primer PDF es morosidad

    await waitFor(() => {
      expect(reportService.downloadDelinquencyReport).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({
          format: 'pdf',
        })
      );
    });
  });

  it('descarga reporte de ingresos en Excel', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    reportService.downloadIncomeReport.mockResolvedValue(blob);

    render(<AdminReportsPage />);

    // Buscar el botón de descargar Excel
    const excelButtons = screen.getAllByRole('button', { name: /Descargar Excel/i });
    await user.click(excelButtons[0]); // Primer Excel es ingresos

    await waitFor(() => {
      expect(reportService.downloadIncomeReport).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({
          format: 'excel',
        })
      );
    });
  });

  it('muestra estado de carga mientras descarga', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['test'], { type: 'application/pdf' });
    reportService.downloadDelinquencyReport.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve(blob), 100))
    );

    render(<AdminReportsPage />);

    const pdfButtons = screen.getAllByRole('button', { name: /Descargar PDF/i });
    await user.click(pdfButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Generando...')).toBeInTheDocument();
    });
  });

  it('muestra mensaje de error si falla la descarga', async () => {
    const user = userEvent.setup();
    reportService.downloadDelinquencyReport.mockRejectedValue(new Error('Network error'));

    render(<AdminReportsPage />);

    const pdfButtons = screen.getAllByRole('button', { name: /Descargar PDF/i });
    await user.click(pdfButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Error al generar el reporte/i)).toBeInTheDocument();
    });
  });

  it('permite cambiar el período para filtrar reportes', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['test'], { type: 'application/pdf' });
    reportService.downloadDelinquencyReport.mockResolvedValue(blob);

    render(<AdminReportsPage />);

    // Buscar el selector de período
    const monthInput = screen.getByDisplayValue(
      new Date().toISOString().slice(0, 7)
    );

    // Cambiar el período
    await user.clear(monthInput);
    await user.type(monthInput, '2026-03');

    // Descargar un reporte
    const pdfButtons = screen.getAllByRole('button', { name: /Descargar PDF/i });
    await user.click(pdfButtons[0]);

    await waitFor(() => {
      expect(reportService.downloadDelinquencyReport).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({
          period: '2026-03',
        })
      );
    });
  });
});
