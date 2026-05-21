# Requerimiento: MVP Gestión de Edificios

## Descripción General

Sistema MVP para la administración financiera y operativa de un edificio único. El sistema permite gestionar propietarios (que pueden poseer múltiples departamentos), registrar pagos (incluso parciales), multas y gastos. No genera cobros mensuales automáticos, sino que se basa en un registro de cuotas mensuales esperadas (parametrizadas históricamente por período) y el ingreso manual de los pagos. Además, incluye reportes detallados en PDF y Excel para administradores y propietarios.

## Problema / Necesidad

Actualmente se requiere una solución base (MVP) que permita llevar el control de la morosidad y los ingresos/gastos del edificio sin la complejidad de un motor de facturación recurrente. Se necesita un flujo operativo que permita cargar un valor esperado mensual por departamento y contrastarlo contra registros manuales de pagos y multas para calcular la morosidad, todo visualizado a través de estados de cuenta claros.

## Solución Propuesta

### 1. Gestión de Usuarios y Roles
- **ADMIN**: Gestiona departamentos, propietarios, pagos, multas, gastos y visualiza todos los reportes de morosidad y balances.
- **PROPIETARIO**: Visualiza el estado de sus departamentos, pagos realizados, multas pendientes y su estado de cuenta personal (descargable).

### 2. Maestros (Departamentos y Propietarios)
- Gestión de departamentos (código, piso, estado).
- Gestión de propietarios (datos personales).
- Relación **muchos a muchos**: un propietario puede tener varios departamentos.

### 3. Cuotas por Período (`YYYY-MM`)
- Registro de cuotas esperadas (`monthly_fee`) mediante un histórico por período para cada departamento (`apartment_fees`), permitiendo cambiar la alícuota en el tiempo sin afectar períodos pasados.
- Posibilidad de carga masiva de cuotas por período vía interfaz web para facilitar la operación del administrador.

### 4. Pagos y Multas
- **Pagos**: Registro manual indicando departamento, período exacto (`YYYY-MM`), monto y comprobante adjunto. Se permiten pagos parciales (se suman por período). Un pago aplica a un solo período.
- **Multas**: Registro manual indicando departamento, período (`YYYY-MM`), motivo y valor directo. Afecta directamente el saldo del período.

### 5. Cálculo de Morosidad y Estado de Cuenta
Cálculo de saldo por período por departamento:
- **Esperado**: Valor de la cuota para ese período (`apartment_fees.amount`). 0 si no está configurada.
- **Multas**: Suma de multas activas en ese período.
- **Pagado**: Suma de pagos registrados en ese período.
- **Fórmula**: `Saldo = (Esperado + Multas) - Pagado`.
- **Regla de Vencimiento**: El período se considera vencido si el día actual es mayor al día 5 (configurable, por defecto 5) del mes correspondiente y el saldo es mayor a 0.

### 6. Control de Gastos
- Registro de gastos del edificio detallando fecha, proveedor, categoría, concepto, valor y comprobante.

### 7. Reportes (PDF / Excel)
- **Admin**: Ingresos, gastos, balance mensual, morosidad global y detallada.
- **Propietario**: Estado de cuenta personal con columnas: Período | Esperado | Multas | Pagado | Saldo.

## Contexto Técnico

- **Arquitectura sugerida**: Monolito (Front en React/Angular/Next + API REST en FastApi) + Base de Datos en **PostgreSQL**.
- **Autenticación**: JWT + refresh token (o cookies HttpOnly web) para acceso mediante Email y Contraseña. Recuperación de contraseña requerida.
- **Almacenamiento de Archivos**: S3 / MinIO para comprobantes.
- **Generación de Reportes**: Server-side para Excel y plantillas HTML a PDF o motor de reportes.
- **Estructura de Períodos**: Clave usar el formato `char(7)` => `YYYY-MM` para correlacionar cobros y pagos.
- **Estado de entidades**: Todo maneja `created_at` y estado lógico (`ACTIVA`, `ANULADA`, `REGISTRADO`).

## Criterios de Aceptación (Alto Nivel)

1. El sistema permite registrar cuotas (`monthly_fee`) específicas por `YYYY-MM` para cada departamento.
2. Todo pago y multa debe asociarse obligatoriamente a un `apartment_id` y a un `período (YYYY-MM)`.
3. El sistema permite registrar múltiples pagos parciales para un mismo departamento y agregarlos al total pagado del período.
4. Un departamento se marca "En mora" **estrictamente** si la suma pagada no cubre el esperado + multas a partir del día 6 del mes en curso.
5. El propietario debe poder visualizar la información de todos los departamentos asignados a su cuenta consolidados, y extraer sus reportes PDF/Excel.
6. El Administrador puede emitir balances mensuales contrastando las sumas de ingresos (pagos registrados) vs egresos (gastos).

## Restricciones

- No se debe desarrollar un motor cron programado para crear deuda ("facturas") automáticas; el saldo se calcula al vuelo con base en el paramétrico del período.
- Se asume la administración de un único edificio (Single-tenant).
- Un pago individual aplica única y exclusivamente a un período (`YYYY-MM`). No divide saldos automáticamente hacia otros períodos.
- Si un departamento no tiene cuota configurada (`apartment_fees`) para un período, el esperado se asume en 0 o pendiente de parametrizar.

## Prioridad

Alta — define el núcleo (MVP) de la solución integral de gestión del edificio.