import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import * as reportService from '../../services/reportService';
import PeriodSelector from '../../components/PeriodSelector/PeriodSelector';
import styles from './AdminReportsPage.module.css';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage() {
  const { token } = useAuth();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  const handleDownload = async (type, format) => {
    const key = `${type}-${format}`;
    setLoading((prev) => ({ ...prev, [key]: true }));
    setError(null);
    try {
      let blob;
      if (type === 'delinquency') blob = await reportService.downloadDelinquencyReport(token, { period, format });
      else if (type === 'income') blob = await reportService.downloadIncomeReport(token, { period, format });
      else if (type === 'balance') blob = await reportService.downloadBalanceReport(token, { period, format });

      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      triggerDownload(blob, `reporte-${type}-${period}.${ext}`);
    } catch {
      setError('Error al generar el reporte. Intenta nuevamente.');
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const REPORTS = [
    {
      key: 'delinquency',
      title: 'Reporte de Morosidad',
      description: 'Lista de propietarios con saldo vencido, detalle por departamento y período.',
      icon: '🔴',
      formats: ['pdf', 'excel'],
    },
    {
      key: 'income',
      title: 'Reporte de Ingresos',
      description: 'Todos los pagos registrados del período con totales por propietario.',
      icon: '💰',
      formats: ['pdf', 'excel'],
    },
    {
      key: 'balance',
      title: 'Balance Ingresos / Egresos',
      description: 'Comparativa entre ingresos (pagos) y egresos (gastos) del período.',
      icon: '⚖️',
      formats: ['pdf'],
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Reportes</h1>
        <PeriodSelector period={period} onChange={setPeriod} label="Período:" />
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.grid}>
        {REPORTS.map((report) => (
          <div key={report.key} className={styles.card}>
            <span className={styles.cardIcon}>{report.icon}</span>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{report.title}</h3>
              <p className={styles.cardDesc}>{report.description}</p>
              <div className={styles.cardActions}>
                {report.formats.map((fmt) => (
                  <button
                    key={fmt}
                    className={fmt === 'pdf' ? styles.btnPdf : styles.btnExcel}
                    onClick={() => handleDownload(report.key, fmt)}
                    disabled={loading[`${report.key}-${fmt}`]}
                  >
                    {loading[`${report.key}-${fmt}`]
                      ? 'Generando...'
                      : fmt === 'pdf' ? '📄 Descargar PDF' : '📊 Descargar Excel'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
