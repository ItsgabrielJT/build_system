---
id: SPEC-004
status: DRAFT
feature: mejoras-críticas-fase-2
created: 2026-05-21
updated: 2026-05-21
author: spec-generator
version: "1.0"
related-specs:
  - gestion-edificios-mvp.spec.md
  - autenticacion-bd-local.spec.md
---

# Spec: Mejoras Críticas Fase 2 — Correcciones y Enhancements

> **Estado:** `DRAFT` → Requiere aprobación antes de implementación.
> **Impacto:** Alto — Afecta módulos core: Departamentos, Pagos, Multas, Reportes.

---

## 1. REQUERIMIENTOS

### Descripción

Esta especificación agrupa **correcciones críticas** y **mejoras funcionales** que impactan la experiencia del usuario en cuatro módulos:

1. **Departamentos**: Mostrar propietarios asignados, permitir editar información del edificio.
2. **Pagos**: Auto-cargar propietario al seleccionar departamento, período por defecto = mes actual, corregir error 500.
3. **Multas**: Auto-cargar propietario al seleccionar departamento, corregir error 500.
4. **Reportes**: Implementar descarga en PDF y Excel (además de CSV actual).

### Problemas Reportados

**Backend Errors (HTTP 500)**
- POST `/api/v1/payments`: `KeyError: 'uid'` en `payments.py:38`
- POST `/api/v1/fines`: `KeyError: 'uid'` en `fines.py:35`
- POST `/api/v1/expenses`: `KeyError: 'uid'` en `expenses.py:33`
- Root cause: dependencia retorna `user_id` pero código accede a `user["uid"]`

**Frontend UX Issues**
- Departamentos: No se ven propietarios asignados en la lista.
- Departamentos: Falta opción de editar información del edificio.
- Pagos: Propietario no auto-completa al seleccionar departamento.
- Pagos: Período no tiene por defecto el mes actual.
- Multas: Propietario no auto-completa al seleccionar departamento.
- Reportes: Botones de PDF/Excel no funcionan (API no existe).

---

## 1.1 Historias de Usuario

### HU-01: Corregir Error de Autenticación en Pagos y Multas

```
Como:        Administrador
Quiero:      Crear pagos y multas sin errores 500
Para:        Poder registrar operaciones financieras sin problemas técnicos

Prioridad:   Crítica
Estimación:  XS
Dependencias: Ninguna
Capa:        Backend
```

#### Criterios de Aceptación — HU-01

**Happy Path**
```gherkin
CRITERIO-1.1: Crear pago con usuario autenticado
  Dado que:  estoy autenticado como Administrador
  Cuando:    envío POST /api/v1/payments con datos válidos
  Entonces:  retorna HTTP 201 y el pago se registra correctamente
```

**Happy Path**
```gherkin
CRITERIO-1.2: Crear multa con usuario autenticado
  Dado que:  estoy autenticado como Administrador
  Cuando:    envío POST /api/v1/fines con datos válidos
  Entonces:  retorna HTTP 201 y la multa se registra correctamente
```

**Happy Path**
```gherkin
CRITERIO-1.3: Crear gasto con usuario autenticado
  Dado que:  estoy autenticado como Administrador
  Cuando:    envío POST /api/v1/expenses con datos válidos
  Entonces:  retorna HTTP 201 y el gasto se registra correctamente
```

---

### HU-02: Mostrar Propietarios Asignados en Departamentos

```
Como:        Administrador
Quiero:      Ver cuáles propietarios están asignados a cada departamento
Para:        Gestionar las relaciones sin confusiones

Prioridad:   Alta
Estimación:  S
Dependencias: HU-01 (corrección auth)
Capa:        Frontend
```

#### Criterios de Aceptación — HU-02

**Happy Path**
```gherkin
CRITERIO-2.1: Listar departamentos con propietarios asignados
  Dado que:  estoy en la página de Departamentos
  Cuando:    la página carga la lista de departamentos
  Entonces:  cada departamento muestra el nombre del propietario asignado (si existe)
  Y:        existe un botón "Asignar Propietario" si no tiene asignado
```

**Edge Case**
```gherkin
CRITERIO-2.2: Departamento sin propietario asignado
  Dado que:  hay departamentos sin propietario
  Cuando:    veo la lista de departamentos
  Entonces:  muestra "Sin asignar" o estado vacío claramente
  Y:        permite asignar propietario directamente desde la lista
```

---

### HU-03: Editar Información del Edificio

```
Como:        Administrador
Quiero:      Editar información del edificio (nombre, dirección, etc.)
Para:        Mantener la información actualizada

Prioridad:   Media
Estimación:  S
Dependencias: Ninguna
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-03

**Happy Path**
```gherkin
CRITERIO-3.1: Acceso a edición de edificio
  Dado que:  estoy en la sección de Departamentos
  Cuando:    hago clic en "Editar Información del Edificio"
  Entonces:  se abre un modal/formulario con los datos actuales del edificio
  Y:        puedo editar campos: nombre, dirección, teléfono, email
```

**Happy Path**
```gherkin
CRITERIO-3.2: Guardar cambios del edificio
  Dado que:  tengo el formulario abierto con cambios
  Cuando:    hago clic en "Guardar"
  Entonces:  PUT /api/v1/buildings/{id} retorna 200
  Y:        los cambios se reflejan inmediatamente en la UI
```

---

### HU-04: Auto-cargar Propietario al Seleccionar Departamento

```
Como:        Administrador
Quiero:      Al seleccionar un departamento en Pagos/Multas, se cargue automáticamente el propietario
Para:        Agilizar el registro de operaciones financieras

Prioridad:   Alta
Estimación:  XS
Dependencias: HU-01 (corrección auth)
Capa:        Frontend
```

#### Criterios de Aceptación — HU-04

**Happy Path**
```gherkin
CRITERIO-4.1: Auto-cargar propietario en Pagos
  Dado que:  estoy en el formulario de Pagos
  Cuando:    selecciono un departamento del dropdown
  Entonces:  el campo "Propietario" se completa automáticamente
  Y:        el propietario es el asignado al departamento en ese momento
```

**Happy Path**
```gherkin
CRITERIO-4.2: Auto-cargar departamento en Pagos (selección inversa)
  Dado que:  estoy en el formulario de Pagos
  Cuando:    selecciono un propietario del dropdown
  Entonces:  se carga solo la lista de departamentos asignados a ese propietario
  Y:        el primer departamento se pre-selecciona si hay solo uno
```

**Happy Path**
```gherkin
CRITERIO-4.3: Comportamiento igual en Multas
  Dado que:  estoy en el formulario de Multas
  Cuando:    selecciono departamento o propietario
  Entonces:  funciona exactamente igual que en Pagos (auto-carga inversa)
```

---

### HU-05: Período por Defecto = Mes Actual

```
Como:        Administrador
Quiero:      En Pagos y Multas, el período esté pre-seleccionado con el mes actual
Para:        No tener que seleccionar manualmente en operaciones recurrentes

Prioridad:   Media
Estimación:  XS
Dependencias: Ninguna
Capa:        Frontend
```

#### Criterios de Aceptación — HU-05

**Happy Path**
```gherkin
CRITERIO-5.1: Período pre-cargado en formulario de Pagos
  Dado que:  abro el formulario de crear Pago
  Cuando:    la página termina de cargar
  Entonces:  el campo "Período" contiene el mes actual (YYYY-MM)
  Y:        ejemplo: si hoy es 2026-05-21, muestra "2026-05"
```

**Happy Path**
```gherkin
CRITERIO-5.2: Período pre-cargado en formulario de Multas
  Dado que:  abro el formulario de crear Multa
  Cuando:    la página termina de cargar
  Entonces:  el campo "Período" contiene el mes actual (YYYY-MM)
```

---

### HU-06: Descargar Reportes en PDF y Excel

```
Como:        Administrador
Quiero:      Descargar reportes en PDF y Excel además de CSV
Para:        Distribuir información en formato profesional

Prioridad:   Alta
Estimación:  M
Dependencias: HU-01 (corrección auth)
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-06

**Happy Path**
```gherkin
CRITERIO-6.1: Descargar reporte de Ingresos en PDF
  Dado que:  estoy en Reportes → Ingresos
  Cuando:    hago clic en "Descargar PDF"
  Entonces:  se descarga archivo `reporte-ingresos-YYYY-MM.pdf`
  Y:        contiene tabla con: Fecha, Propietario, Depto, Período, Monto, Método, Estado
```

**Happy Path**
```gherkin
CRITERIO-6.2: Descargar reporte de Ingresos en Excel
  Dado que:  estoy en Reportes → Ingresos
  Cuando:    hago clic en "Descargar Excel"
  Entonces:  se descarga archivo `reporte-ingresos-YYYY-MM.xlsx`
  Y:        contiene los mismos datos que PDF en formato de tabla
```

**Happy Path**
```gherkin
CRITERIO-6.3: Descargar reporte de Balance/Resumen en PDF
  Dado que:  estoy en Reportes → Balance
  Cuando:    hago clic en "Descargar PDF"
  Entonces:  se descarga `reporte-balance-YYYY-MM.pdf`
  Y:        contiene: Ingresos, Egresos, Balance Neto
```

**Happy Path**
```gherkin
CRITERIO-6.4: Descargar reporte de Morosidad en Excel
  Dado que:  estoy en Reportes → Morosidad
  Cuando:    hago clic en "Descargar Excel"
  Entonces:  se descarga `reporte-morosidad.xlsx`
  Y:        contiene: Propietario, Email, Documento, Deuda Total, Períodos Vencidos, Estado
```

**Error Path**
```gherkin
CRITERIO-6.5: Reporte sin datos
  Dado que:  no hay datos en el período seleccionado
  Cuando:    intento descargar el reporte
  Entonces:  retorna HTTP 200 pero con documento vacío o con header "Sin datos"
```

---

## 1.2 Reglas de Negocio

### Autenticación
- La dependencia `get_current_user()` debe retornar **`user_id`** (no `uid`) para compatibilidad total.
- Todos los endpoints que crean registros deben usar `created_by=user["user_id"]`.

### Departamentos y Propietarios
1. Un departamento puede tener **máximo un propietario activo**.
2. Al mostrar departamentos, indicar claramente si está asignado o no.
3. Si un departamento tiene propietario, mostrar también el email del propietario.

### Pagos y Multas
1. Al seleccionar un departamento, auto-cargar el propietario asignado.
2. Al seleccionar un propietario, filtrar solo departamentos asignados a ese propietario.
3. El campo "Período" debe inicializar con el mes actual (formato: YYYY-MM).

### Reportes
1. Los reportes pueden generarse en **CSV, PDF y Excel**.
2. El nombre del archivo debe incluir el período (si aplica): `reporte-{tipo}-YYYY-MM.{ext}`
3. Los PDF deben tener:
   - Header con fecha/hora de generación
   - Título del reporte
   - Período consultado
   - Tabla de datos
   - Firma o nota: "Reporte generado automáticamente"

---

## 2. DISEÑO

### 2.1 Cambios Backend

#### Bug Fix: Error de Autenticación

**Archivos afectados:**
- `backend/app/routes/payments.py` (línea 38)
- `backend/app/routes/fines.py` (línea 35)
- `backend/app/routes/expenses.py` (línea 33)
- `backend/app/services/account_statement_service.py` (línea 32)

**Cambio:** Reemplazar `user["uid"]` → `user["user_id"]`

```python
# ANTES (incorrecto):
return await service.create(body, created_by=user["uid"])

# DESPUÉS (correcto):
return await service.create(body, created_by=user["user_id"])
```

---

#### New Endpoint: PUT /api/v1/buildings/{id}

**Descripción:** Actualizar información del edificio (admin only).

**Auth requerida:** sí (admin)

**Request Body:**
```json
{
  "name": "string (obligatorio)",
  "address": "string",
  "phone": "string",
  "email": "string"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "name": "string",
  "address": "string",
  "phone": "string",
  "email": "string",
  "updated_at": "iso8601"
}
```

**Response 404:** Edificio no encontrado.

---

#### Enhancement: GET /api/v1/apartments — Incluir Propietario

**Cambio en respuesta:**
```json
[
  {
    "id": "uuid",
    "code": "101",
    "building_id": "uuid",
    "owner_id": "uuid (nuevo — puede ser null)",
    "owner_name": "string (nuevo — puede ser null)",
    "owner_email": "string (nuevo — puede ser null)",
    "created_at": "iso8601",
    "updated_at": "iso8601"
  }
]
```

**Justificación:** Frontend necesita mostrar "propietario asignado" sin hacer requests adicionales.

---

#### New Endpoints: PDF/Excel Reports

**GET /api/v1/reports/income**
- Params: `period` (opcional), `format` = `csv|pdf|excel`
- Response: Archive descargable (Content-Disposition: attachment)

**GET /api/v1/reports/balance**
- Params: `period` (opcional), `format` = `csv|pdf|excel`

**GET /api/v1/reports/delinquency**
- Params: `format` = `csv|pdf|excel`

**Nota:** Usar biblioteca `reportlab` (PDF) o `openpyxl` (Excel).

---

### 2.2 Cambios Frontend

#### Componente: ApartmentsList — Mostrar Propietarios

**Archivo:** `frontend/src/pages/admin/AdminApartmentsPage.jsx`

**Cambios:**
- Columna nueva: "Propietario" que muestre nombre o "Sin asignar"
- Botón "Asignar" para los sin propietario
- Botón "Cambiar Propietario" para los con asignación actual

---

#### Componente: BuildingInfoModal (NEW)

**Archivo:** `frontend/src/components/BuildingInfoModal/BuildingInfoModal.jsx`

**Props:**
```javascript
{
  isOpen: boolean,
  onClose: () => void,
  onSave: (data) => Promise,
  building: { id, name, address, phone, email }
}
```

**Funcionalidad:**
- Modal con formulario editable
- Campos: Nombre del Edificio, Dirección, Teléfono, Email
- Botones: Guardar, Cancelar

---

#### Component: PaymentFormModal — Auto-cargar Propietario

**Archivo:** `frontend/src/components/PaymentFormModal.jsx`

**Cambios:**
- Al cambiar apartamento → auto-cargar propietario
- Al cambiar propietario → filtrar solo sus apartamentos
- Campo período pre-cargado con mes actual

**Lógica:**
```javascript
const handleApartmentChange = (apartmentId) => {
  const apartment = apartments.find(a => a.id === apartmentId);
  if (apartment?.owner_id) {
    setFormData(prev => ({
      ...prev,
      apartment_id: apartmentId,
      owner_id: apartment.owner_id,
      owner_name: apartment.owner_name
    }));
  }
};

const handleOwnerChange = (ownerId) => {
  const filtered = apartments.filter(a => a.owner_id === ownerId);
  setFilteredApartments(filtered);
  setFormData(prev => ({
    ...prev,
    owner_id: ownerId,
    apartment_id: filtered.length === 1 ? filtered[0].id : null
  }));
};

useEffect(() => {
  // Pre-cargar período con mes actual
  const today = new Date();
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  setFormData(prev => ({ ...prev, period }));
}, []);
```

---

#### Component: FineFormModal — Igual que Pagos

**Archivo:** `frontend/src/components/FineFormModal.jsx`

**Cambios:** Idénticos a PaymentFormModal (auto-cargar propietario y período).

---

#### Component: ReportButtons — PDF/Excel

**Archivo:** `frontend/src/pages/admin/AdminReportsPage.jsx`

**Cambios:**
- Agregar botones "Descargar PDF" y "Descargar Excel"
- Implementar llamadas con `?format=pdf` y `?format=excel`

---

### 2.3 Base de Datos

#### Tabla: buildings (NEW — si no existe)

```sql
CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabla: apartments — Agregar Columna

```sql
ALTER TABLE apartments
ADD COLUMN owner_id UUID REFERENCES owners(id) ON DELETE SET NULL;

-- Índice para búsquedas rápidas
CREATE INDEX idx_apartments_owner_id ON apartments(owner_id);
```

---

## 3. LISTA DE TAREAS

### Backend

- [ ] **T1-01**: Corregir `user["uid"]` → `user["user_id"]` en payments.py, fines.py, expenses.py, account_statement_service.py
  - Archivos: `backend/app/routes/payments.py:38`, `fines.py:35`, `expenses.py:33`, `account_statement_service.py:32`
  
- [ ] **T1-02**: Implementar endpoint `PUT /api/v1/buildings/{id}` con validación de admin
  - Archivo: `backend/app/routes/apartments.py` (nueva ruta)
  - Requiere: `BuildingService`, modelo de validación
  
- [ ] **T1-03**: Modificar `GET /api/v1/apartments` para incluir owner_id, owner_name, owner_email
  - Archivo: `backend/app/services/apartment_service.py`
  - Requiere: JOIN con tabla owners en query
  
- [ ] **T1-04**: Implementar descarga PDF — Instalación de `reportlab` y generador de reportes
  - Archivo: `backend/app/services/report_service.py`
  - Métodos: `income_pdf()`, `balance_pdf()`, `delinquency_pdf()`
  - Ruta: modificar `GET /api/v1/reports/income?format=pdf`
  
- [ ] **T1-05**: Implementar descarga Excel — Instalación de `openpyxl` y generador de reportes
  - Archivo: `backend/app/services/report_service.py`
  - Métodos: `income_excel()`, `balance_excel()`, `delinquency_excel()`
  - Ruta: modificar `GET /api/v1/reports/income?format=excel`
  
- [ ] **T1-06**: Tests unitarios para endpoints corregidos
  - Archivos: `backend/tests/test_payments.py`, `test_fines.py`, `test_expenses.py`

---

### Frontend

- [ ] **T2-01**: Actualizar `AdminApartmentsPage.jsx` para mostrar propietario en tabla
  - Agregar columna: "Propietario"
  - Mostrar nombre o "Sin asignar"
  - Botones de acción: "Asignar", "Cambiar"
  
- [ ] **T2-02**: Crear componente `BuildingInfoModal.jsx`
  - Props: isOpen, onClose, onSave, building
  - Formulario editable con validación
  
- [ ] **T2-03**: Agregar botón "Editar Información del Edificio" en AdminApartmentsPage
  - Hook para obtener datos del edificio
  - Abrir modal al hacer clic
  
- [ ] **T2-04**: Modificar `PaymentFormModal.jsx`
  - Auto-cargar propietario al cambiar apartamento
  - Filtrar apartamentos al cambiar propietario
  - Pre-cargar período con mes actual
  
- [ ] **T2-05**: Modificar `FineFormModal.jsx` (igual a T2-04)
  - Auto-cargar propietario al cambiar apartamento
  - Filtrar apartamentos al cambiar propietario
  - Pre-cargar período con mes actual
  
- [ ] **T2-06**: Actualizar `AdminReportsPage.jsx` para descargar PDF/Excel
  - Agregar botones con format=pdf y format=excel
  - Manejar descarga de archivos
  
- [ ] **T2-07**: Tests de componentes de formularios
  - Archivos: `frontend/src/__tests__/components/PaymentFormModal.test.jsx`
  - Verificar auto-carga de propietario y período

---

### QA / Testing

- [ ] **T3-01**: Tests E2E para flujo de Pagos (crear con auto-carga de propietario)
- [ ] **T3-02**: Tests E2E para flujo de Multas (crear con auto-carga de propietario)
- [ ] **T3-03**: Tests E2E para descarga de reportes (PDF, Excel)
- [ ] **T3-04**: Tests de validación de permiso (solo admin puede editar edificio)
- [ ] **T3-05**: Tests de error handling (período vacío, propietario sin departamentos, etc.)

---

### Infraestructura / Dependencias

- [ ] Instalar `reportlab` en backend (requirements.txt)
  ```
  reportlab==4.0.7
  ```

- [ ] Instalar `openpyxl` en backend (requirements.txt)
  ```
  openpyxl==3.10.5
  ```

- [ ] Migración de BD: `ALTER TABLE apartments ADD COLUMN owner_id UUID REFERENCES owners(id) ON DELETE SET NULL;`

---

## Próximos Pasos

1. **Aprobación**: Cambiar status a `APPROVED` una vez revisada.
2. **Backend**: Ejecutar implementación en paralelo con Frontend.
3. **Testing**: QA begin gherkin y E2E tests.
4. **Deployment**: Merge a main después de code review.

