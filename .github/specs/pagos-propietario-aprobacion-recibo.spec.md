---
id: SPEC-008
status: APPROVED
feature: pagos-propietario-aprobacion-recibo
created: 2026-05-31
updated: 2026-05-31
author: spec-generator
version: "1.0"
related-specs: ["autenticacion-bd-local", "rediseno-gestion-cuotas", "mejoras-criticas-s2"]
---

# Spec: Pagos del Propietario con Comprobante, Aprobación y Recibo

> **Estado:** `APPROVED` → lista para iniciar implementación.
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED → DEPRECATED

---

## 1. REQUERIMIENTOS

### Descripción
Se agregará un flujo de pagos para PROPIETARIO donde pueda registrar una solicitud de pago subiendo su comprobante para un período adeudado. La solicitud quedará pendiente de revisión por el ADMIN, generará una constancia inmediata de envío y solo habilitará el recibo oficial cuando la aprobación administrativa se complete.

### Requerimiento de Negocio
El PROPIETARIO necesita registrar pagos sin depender de captura manual del ADMIN, manteniendo control administrativo y trazabilidad completa. El ADMIN necesita enterarse de inmediato de los pagos pendientes, revisarlos, aprobarlos o rechazarlos, y asegurar que solo los pagos válidos impacten la contabilidad y el estado de cuenta.

### Historias de Usuario

#### HU-01: Registrar solicitud de pago con comprobante

```
Como:        Propietario
Quiero:      registrar una solicitud de pago adjuntando un comprobante para un período de uno de mis departamentos
Para:        notificar el pago realizado y dejar evidencia para revisión administrativa

Prioridad:   Alta
Estimación:  L
Dependencias: Ninguna
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-01

**Happy Path**
```gherkin
CRITERIO-1.1: Registrar solicitud pendiente
  Dado que:  soy un PROPIETARIO autenticado con un departamento asignado y un período con saldo pendiente
  Cuando:    envío monto, fecha de pago, método, referencia opcional y un comprobante válido
  Entonces:  el sistema registra la solicitud con estado PENDIENTE_APROBACION
             y genera una constancia de envío descargable
             y responde 201 con el detalle del pago solicitado
```

```gherkin
CRITERIO-1.2: Notificar al administrador
  Dado que:  la solicitud de pago fue registrada correctamente
  Cuando:    finaliza la transacción de creación
  Entonces:  el sistema crea una notificación interna para ADMIN
             y dispara una notificación por correo con el identificador del pago pendiente
```

**Error Path**
```gherkin
CRITERIO-1.3: Rechazar solicitud sobre recurso no autorizado
  Dado que:  soy un PROPIETARIO autenticado
  Cuando:    intento registrar un pago para un departamento que no me pertenece
  Entonces:  el sistema rechaza la operación con 403
             y retorna un mensaje indicando que no tengo acceso al recurso
```

```gherkin
CRITERIO-1.4: Rechazar comprobante inválido
  Dado que:  intento registrar una solicitud de pago
  Cuando:    adjunto un archivo vacío, no soportado o que excede el tamaño permitido
  Entonces:  el sistema rechaza la operación con 422
             y retorna un mensaje de validación del comprobante
```

**Edge Case**
```gherkin
CRITERIO-1.5: Reenvío después de rechazo
  Dado que:  existe una solicitud de pago rechazada para el mismo departamento y período
  Cuando:    el PROPIETARIO reenvía un nuevo comprobante
  Entonces:  el sistema conserva trazabilidad del rechazo previo
             y crea una nueva revisión pendiente asociada al mismo pago
```

#### HU-02: Revisar y resolver solicitudes pendientes

```
Como:        Administrador
Quiero:      consultar pagos pendientes y aprobarlos o rechazarlos con trazabilidad
Para:        controlar qué pagos se reconocen oficialmente en el sistema

Prioridad:   Alta
Estimación:  L
Dependencias: HU-01
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-02

**Happy Path**
```gherkin
CRITERIO-2.1: Aprobar pago pendiente
  Dado que:  soy un ADMIN autenticado y existe un pago en estado PENDIENTE_APROBACION
  Cuando:    reviso el comprobante y apruebo la solicitud
  Entonces:  el sistema cambia el estado a APROBADO
             y registra approved_by y approved_at
             y habilita la descarga del recibo oficial para el PROPIETARIO
             y retorna 200 con el pago actualizado
```

```gherkin
CRITERIO-2.2: Rechazar pago pendiente
  Dado que:  soy un ADMIN autenticado y existe un pago en estado PENDIENTE_APROBACION
  Cuando:    rechazo la solicitud indicando un motivo
  Entonces:  el sistema cambia el estado a RECHAZADO
             y registra rejected_by, rejected_at y rejection_reason
             y el PROPIETARIO ve el rechazo en su historial
```

**Error Path**
```gherkin
CRITERIO-2.3: Evitar resolución duplicada
  Dado que:  un pago ya fue APROBADO o RECHAZADO
  Cuando:    un ADMIN intenta volver a resolverlo
  Entonces:  el sistema responde 422
             y retorna un mensaje de transición inválida
```

#### HU-03: Descargar constancia y recibo oficial

```
Como:        Propietario
Quiero:      descargar la constancia de envío y luego el recibo oficial cuando corresponda
Para:        tener respaldo de la gestión y comprobante oficial del pago reconocido

Prioridad:   Alta
Estimación:  M
Dependencias: HU-01, HU-02
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-03

**Happy Path**
```gherkin
CRITERIO-3.1: Descargar constancia inmediata
  Dado que:  una solicitud de pago fue creada por el PROPIETARIO
  Cuando:    consulta el detalle del pago o su historial
  Entonces:  puede descargar una constancia de envío en PDF
             aun si el estado sigue pendiente
```

```gherkin
CRITERIO-3.2: Descargar recibo oficial aprobado
  Dado que:  un pago fue APROBADO
  Cuando:    el PROPIETARIO solicita el recibo oficial
  Entonces:  el sistema genera o entrega un PDF del recibo
             y responde 200 con el archivo descargable
```

**Error Path**
```gherkin
CRITERIO-3.3: Bloquear recibo oficial antes de aprobar
  Dado que:  un pago está PENDIENTE_APROBACION o RECHAZADO
  Cuando:    el PROPIETARIO intenta descargar el recibo oficial
  Entonces:  el sistema responde 409
             y retorna un mensaje indicando que el pago aún no tiene recibo oficial disponible
```

### Reglas de Negocio
1. La constancia de envío se genera al crear la solicitud y no equivale al recibo oficial.
2. Solo el ADMIN puede aprobar o rechazar pagos pendientes.
3. Solo el PROPIETARIO titular del pago puede ver o descargar su constancia y su recibo oficial.
4. El recibo oficial se habilita únicamente para pagos con estado APROBADO.
5. Cada decisión administrativa debe registrar usuario, fecha y motivo si aplica.
6. El monto aprobado debe impactar la contabilidad solo cuando el pago esté APROBADO.
7. El sistema debe aceptar reenvío de comprobante tras rechazo sin perder historial previo.
8. El comprobante debe cumplir validaciones mínimas de tipo y tamaño definidas en settings.

---

## 2. DISEÑO

### Modelos de Datos

#### Entidades afectadas
| Entidad | Almacén | Cambios | Descripción |
|---------|---------|---------|-------------|
| `Payment` | tabla `payments` | modificada | Amplía el ciclo de vida del pago con estados de revisión y datos de auditoría |
| `PaymentProof` | tabla `payment_proofs` | nueva | Guarda metadata del comprobante y sus revisiones |
| `Notification` | tabla `notifications` | nueva | Bandeja interna para eventos dirigidos a ADMIN |

#### Campos del modelo
| Campo | Tipo | Obligatorio | Validación | Descripción |
|-------|------|-------------|------------|-------------|
| `id` | UUID | sí | auto-generado | Identificador del pago |
| `apartment_id` | UUID | sí | debe pertenecer al PROPIETARIO solicitante | Departamento asociado |
| `owner_id` | UUID | sí | debe existir | Propietario asociado |
| `period` | string | sí | formato YYYY-MM | Período pagado |
| `paid_at` | date | sí | fecha válida | Fecha indicada por el usuario |
| `amount` | decimal | sí | > 0 | Monto reportado |
| `method` | string | no | catálogo configurable | Método de pago |
| `reference` | string | no | max 120 chars | Referencia externa |
| `status` | string enum | sí | PENDIENTE_APROBACION, APROBADO, RECHAZADO, ANULADO | Estado del pago |
| `approved_by` | string | no | uid/admin id válido | Usuario que aprueba |
| `approved_at` | datetime UTC | no | auto | Fecha de aprobación |
| `rejected_by` | string | no | uid/admin id válido | Usuario que rechaza |
| `rejected_at` | datetime UTC | no | auto | Fecha de rechazo |
| `rejection_reason` | string | no | max 500 chars | Motivo de rechazo |
| `created_by` | string | sí | uid válido | Usuario que crea |
| `created_at` | datetime UTC | sí | auto | Timestamp creación |
| `updated_at` | datetime UTC | sí | auto | Timestamp actualización |

#### Campos de `payment_proofs`
| Campo | Tipo | Obligatorio | Validación | Descripción |
|-------|------|-------------|------------|-------------|
| `id` | UUID | sí | auto-generado | Identificador del comprobante |
| `payment_id` | UUID | sí | FK lógica | Pago asociado |
| `file_name` | string | sí | max 255 chars | Nombre original |
| `content_type` | string | sí | lista permitida | Tipo MIME |
| `storage_path` | string | sí | no vacío | Ruta del archivo almacenado |
| `uploaded_by` | string | sí | uid válido | Usuario que subió |
| `created_at` | datetime UTC | sí | auto | Timestamp creación |

#### Índices / Constraints
- Índice en `payments(period, owner_id, status)` para historial y filtros por rol.
- Índice en `payments(status, created_at)` para bandeja de pendientes.
- Índice en `payment_proofs(payment_id, created_at)` para revisión cronológica.
- Constraint lógico para impedir aprobación o rechazo si el pago ya fue resuelto.

### API Endpoints

#### POST /api/v1/owner/payments
- **Descripción**: Crea una solicitud de pago del PROPIETARIO con comprobante.
- **Auth requerida**: sí, rol PROPIETARIO.
- **Request**: multipart/form-data con `apartment_id`, `period`, `paid_at`, `amount`, `method`, `reference`, `proof_file`.
- **Response 201**:
  ```json
  {
    "id": "uuid",
    "status": "PENDIENTE_APROBACION",
    "period": "2026-05",
    "amount": 120.5,
    "constancia_disponible": true,
    "created_at": "2026-05-31T10:00:00Z"
  }
  ```
- **Response 403**: intento sobre departamento ajeno.
- **Response 422**: archivo o datos inválidos.

#### GET /api/v1/owner/payments
- **Descripción**: Lista pagos del PROPIETARIO autenticado.
- **Auth requerida**: sí, rol PROPIETARIO.
- **Query Params**: `status`, `period`, `apartment_id` opcionales.
- **Response 200**:
  ```json
  [{
    "id": "uuid",
    "period": "2026-05",
    "amount": 120.5,
    "status": "APROBADO",
    "receipt_available": true,
    "rejection_reason": null
  }]
  ```

#### GET /api/v1/owner/payments/{payment_id}/acknowledgement
- **Descripción**: Descarga la constancia de envío del pago.
- **Auth requerida**: sí, rol PROPIETARIO dueño del pago.
- **Response 200**: archivo PDF.
- **Response 404**: pago no encontrado.

#### GET /api/v1/owner/payments/{payment_id}/receipt
- **Descripción**: Descarga el recibo oficial del pago aprobado.
- **Auth requerida**: sí, rol PROPIETARIO dueño del pago.
- **Response 200**: archivo PDF.
- **Response 409**: pago aún no aprobado.

#### GET /api/v1/admin/payments/pending
- **Descripción**: Lista pagos pendientes de revisión administrativa.
- **Auth requerida**: sí, rol ADMIN.
- **Response 200**:
  ```json
  [{
    "id": "uuid",
    "owner_name": "Juan Perez",
    "apartment_code": "A-101",
    "period": "2026-05",
    "amount": 120.5,
    "proof_file_name": "transferencia.pdf",
    "created_at": "2026-05-31T10:00:00Z"
  }]
  ```

#### PUT /api/v1/admin/payments/{payment_id}/approve
- **Descripción**: Aprueba un pago pendiente.
- **Auth requerida**: sí, rol ADMIN.
- **Response 200**: pago actualizado con estado APROBADO.
- **Response 404**: pago no encontrado.
- **Response 422**: transición inválida.

#### PUT /api/v1/admin/payments/{payment_id}/reject
- **Descripción**: Rechaza un pago pendiente.
- **Auth requerida**: sí, rol ADMIN.
- **Request Body**:
  ```json
  { "reason": "Comprobante ilegible" }
  ```
- **Response 200**: pago actualizado con estado RECHAZADO.
- **Response 422**: motivo faltante o transición inválida.

#### GET /api/v1/admin/notifications/payments
- **Descripción**: Lista notificaciones internas de pagos pendientes para ADMIN.
- **Auth requerida**: sí, rol ADMIN.
- **Response 200**: listado de notificaciones paginadas.

### Diseño Frontend

#### Componentes nuevos
| Componente | Archivo | Props principales | Descripción |
|------------|---------|------------------|-------------|
| `PaymentProofUpload` | `components/PaymentProofUpload/PaymentProofUpload.jsx` | `value, onChange, error` | Control de carga y validación visual del comprobante |
| `PaymentStatusBadge` | `components/PaymentStatusBadge/PaymentStatusBadge.jsx` | `status` | Badge reutilizable de estado del pago |
| `PaymentReviewModal` | `components/PaymentReviewModal/PaymentReviewModal.jsx` | `payment, onApprove, onReject, onClose` | Revisión administrativa del pago pendiente |

#### Páginas nuevas
| Página | Archivo | Ruta | Protegida |
|--------|---------|------|-----------|
| `OwnerPaymentsPage` | `pages/owner/OwnerPaymentsPage.jsx` | `/owner/payments` | sí |

#### Páginas modificadas
| Página | Archivo | Ruta | Cambio |
|--------|---------|------|--------|
| `AdminPaymentsPage` | `pages/admin/AdminPaymentsPage.jsx` | `/admin/payments` | agrega cola de pendientes y resolución |
| `OwnerAccountStatementPage` | `pages/owner/OwnerAccountStatementPage.jsx` | `/owner/account-statement` | agrega accesos a historial de pagos/descargas |

#### Hooks y State
| Hook | Archivo | Retorna | Descripción |
|------|---------|---------|-------------|
| `useOwnerPayments` | `hooks/useOwnerPayments.js` | `{ payments, loading, error, submitPayment, reload }` | Flujo del PROPIETARIO |
| `useAdminPaymentReview` | `hooks/useAdminPaymentReview.js` | `{ pendingPayments, approvePayment, rejectPayment }` | Flujo del ADMIN |

#### Services (llamadas API)
| Función | Archivo | Endpoint |
|---------|---------|---------|
| `submitOwnerPayment(formData, token)` | `services/paymentService.js` | `POST /api/v1/owner/payments` |
| `getOwnerPayments(filters, token)` | `services/paymentService.js` | `GET /api/v1/owner/payments` |
| `downloadPaymentAcknowledgement(paymentId, token)` | `services/paymentService.js` | `GET /api/v1/owner/payments/{payment_id}/acknowledgement` |
| `downloadPaymentReceipt(paymentId, token)` | `services/paymentService.js` | `GET /api/v1/owner/payments/{payment_id}/receipt` |
| `getPendingPayments(token)` | `services/paymentService.js` | `GET /api/v1/admin/payments/pending` |
| `approvePayment(paymentId, token)` | `services/paymentService.js` | `PUT /api/v1/admin/payments/{payment_id}/approve` |
| `rejectPayment(paymentId, payload, token)` | `services/paymentService.js` | `PUT /api/v1/admin/payments/{payment_id}/reject` |

### Arquitectura y Dependencias
- Se requiere una estrategia de storage para adjuntos; si no existe servicio externo, iniciar con almacenamiento local abstraído desde backend.
- El backend debe conservar la arquitectura routes → services → repositories.
- El frontend debe usar Axios en `services/` y CSS Modules para los componentes nuevos.
- Impacto en punto de entrada: registrar nuevas rutas owner/admin en `frontend/src/App.jsx` y routers nuevos en backend si se separan por rol.

### Notas de Implementación
> Se recomienda modelar la aprobación como transiciones explícitas de estado dentro de `PaymentService` y no como banderas aisladas. La generación de PDFs debe reutilizar el patrón existente del módulo de reportes para constancias y recibos.

---

## 3. LISTA DE TAREAS

> Checklist accionable para todos los agentes. Marcar cada ítem (`[x]`) al completarlo.
> El Orchestrator monitorea este checklist para determinar el progreso.

### Backend

#### Implementación
- [ ] Extender schemas de pago con estados y auditoría de aprobación/rechazo
- [ ] Crear modelos/schemas para `PaymentProof`, rechazo y listado owner/admin
- [ ] Implementar repositorio para comprobantes y consultas por rol
- [ ] Implementar servicio de pagos con transiciones PENDIENTE_APROBACION → APROBADO/RECHAZADO
- [ ] Implementar endpoints owner para crear pago, listar historial y descargar constancia/recibo
- [ ] Implementar endpoints admin para listar pendientes, aprobar, rechazar y listar notificaciones
- [ ] Registrar routers y configuración de storage/validaciones

#### Tests Backend
- [ ] `test_create_owner_payment_pending_success`
- [ ] `test_create_owner_payment_forbidden_other_apartment`
- [ ] `test_create_owner_payment_invalid_file_raises_422`
- [ ] `test_approve_pending_payment_success`
- [ ] `test_reject_pending_payment_requires_reason`
- [ ] `test_download_receipt_before_approval_returns_409`
- [ ] `test_list_pending_payments_admin_only`

### Frontend

#### Implementación
- [ ] Extender `paymentService` con endpoints owner/admin y descargas
- [ ] Crear `useOwnerPayments` y `useAdminPaymentReview`
- [ ] Implementar `PaymentProofUpload` y `PaymentStatusBadge`
- [ ] Implementar `OwnerPaymentsPage` con formulario, historial y descargas
- [ ] Extender `AdminPaymentsPage` con revisión y resolución de pendientes
- [ ] Registrar rutas y navegación para PROPIETARIO y ADMIN

#### Tests Frontend
- [ ] `OwnerPaymentsPage submits valid payment proof`
- [ ] `OwnerPaymentsPage shows rejection reason when present`
- [ ] `OwnerPaymentsPage disables receipt button when payment is not approved`
- [ ] `AdminPaymentsPage loads pending payments`
- [ ] `AdminPaymentsPage approves pending payment`
- [ ] `AdminPaymentsPage rejects payment with reason`

### QA
- [ ] Ejecutar skill `/gherkin-case-generator` para HU-01, HU-02 y HU-03
- [ ] Ejecutar skill `/risk-identifier` para adjuntos, aprobaciones y permisos
- [ ] Validar cobertura de reglas de negocio y de transiciones de estado
- [ ] Confirmar consistencia entre historial owner, cola admin y estado de cuenta
- [ ] Actualizar estado spec: `status: IMPLEMENTED`