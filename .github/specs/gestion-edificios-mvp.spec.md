---
id: SPEC-001
status: IMPLEMENTED
feature: gestion-edificios-mvp
created: 2026-05-21
updated: 2026-05-21
author: spec-generator
version: "1.0"
related-specs: []
---

# Spec: MVP Gestión de Edificios — Administración Financiera y Operativa

> **Estado:** `IMPLEMENTED` → se requiere aprobación (`status: IMPLEMENTED`) antes de iniciar implementación.
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED

---
 
## 1. REQUERIMIENTOS

### Descripción
Sistema MVP para administración financiera y operativa de un edificio único. Permite gestionar propietarios con múltiples departamentos, registrar pagos (parciales), multas y gastos, y calcular morosidad basada en cuotas mensuales esperadas parametrizadas por período (`YYYY-MM`), sin generar cobros automáticos. Incluye reportes PDF/Excel para administradores y propietarios.

### Requerimiento de Negocio (de `.github/requirements/gestion_edificios.md`)

El requerimiento define:
1. **Gestión de Usuarios y Roles**: ADMIN (gestión total) y PROPIETARIO (vista de sus departamentos).
2. **Maestros**: Departamentos y Propietarios con relación muchos a muchos.
3. **Cuotas por Período**: Histórico de cuotas mensuales por departamento (`apartment_fees`, formato `YYYY-MM`).
4. **Pagos y Multas**: Registro manual, parciales permitidos, un pago aplica a un único período.
5. **Cálculo de Morosidad**: `Saldo = (Esperado + Multas) - Pagado`. Período vencido si día > 5 y saldo > 0.
6. **Gastos y Balance**: Control de gastos e ingreso/egreso mensual.
7. **Reportes**: PDF/Excel para ADMIN (ingresos, gastos, balance, morosidad) y PROPIETARIO (estado de cuenta personal).

---

## 2. DISEÑO

### Historias de Usuario

#### HU-01: ADMIN — Gestión de Propietarios (CRUD)

```
Como:        Administrador del edificio
Quiero:      Crear, actualizar, listar y eliminar propietarios
Para:        Llevar un registro centralizado de los dueños de departamentos

Prioridad:   Alta
Estimación:  M
Dependencias: Ninguna (base)
Capa:        Backend + Frontend
```

##### Criterios de Aceptación — HU-01

**Happy Path — Crear Propietario**
```gherkin
CRITERIO-1.1: Crear propietario con datos válidos
  Dado que:  El administrador está en la pantalla de propietarios
  Cuando:    Ingresa nombre, documento, teléfono y email y presiona "Guardar"
  Entonces:  Se registra el propietario con uid único y retorna 201
             El propietario aparece en la lista
```

**Error Path — Validación**
```gherkin
CRITERIO-1.2: Rechazar propietario con documento duplicado
  Dado que:  Existe un propietario con document_id = "12345"
  Cuando:    Intenta crear uno nuevo con el mismo document_id
  Entonces:  Retorna 409 Conflict con mensaje "Documento ya registrado"
```

**Happy Path — Listar**
```gherkin
CRITERIO-1.3: Listar todos los propietarios
  Dado que:  Existen 5 propietarios
  Cuando:    Accede a GET /api/v1/owners
  Entonces:  Retorna array de 5 propietarios con campos: id, full_name, document_id, email, created_at
```

---

#### HU-02: ADMIN — Gestión de Departamentos con Asignación a Propietarios

```
Como:        Administrador
Quiero:      Crear departamentos y asignarlos a propietarios (relación muchos a muchos)
Para:        Definir la estructura física del edificio y sus responsables

Prioridad:   Alta
Estimación:  M
Dependencias: HU-01
Capa:        Backend + Frontend
```

##### Criterios de Aceptación — HU-02

**Happy Path — Crear Departamento**
```gherkin
CRITERIO-2.1: Crear departamento con código único
  Dado que:  El administrador está en "Departamentos"
  Cuando:    Ingresa código (ej. "101"), piso (1), y presiona "Crear"
  Entonces:  Se crea el departamento con status = "ACTIVO"
             Retorna 201 con uid y código
```

**Happy Path — Asignar Propietario**
```gherkin
CRITERIO-2.2: Asignar propietario a departamento
  Dado que:  Existen el departamento "101" y propietario "Juan Pérez"
  Cuando:    Admin selecciona el departamento y lo asigna al propietario via UI
  Entonces:  Se crea la relación en owner_apartments
             El propietario puede visualizar ese departamento en su perfil
```

**Edge Case — Un propietario, múltiples departamentos**
```gherkin
CRITERIO-2.3: Un propietario posee varios departamentos
  Dado que:  Propietario "María" está asignado a deptos "101", "102", "103"
  Cuando:    Admin consulta los departamentos de "María"
  Entonces:  Se retornan los 3 departamentos con sus datos (código, piso, monthly_fee)
```

---

#### HU-03: ADMIN — Carga de Cuotas Mensuales por Período

```
Como:        Administrador
Quiero:      Registrar la cuota mensual esperada (monthly_fee) para cada departamento por período (YYYY-MM)
Para:        Establecer la base sobre la que se calcula la morosidad y los reportes

Prioridad:   Alta
Estimación:  M
Dependencias: HU-02
Capa:        Backend + Frontend
```

##### Criterios de Aceptación — HU-03

**Happy Path — Crear Cuota por Período**
```gherkin
CRITERIO-3.1: Cargar cuota para un departamento en un período
  Dado que:  Período actual es "2026-05" y existe departamento "101"
  Cuando:    Admin carga monthly_fee = 5000 para período "2026-05"
  Entonces:  Se crea apartment_fees con id único, apartment_id, period="2026-05", amount=5000
             Retorna 201
```

**Validación — Unicidad por período**
```gherkin
CRITERIO-3.2: Evitar duplicado de cuota por departamento-período
  Dado que:  Ya existe apartment_fees para depto "101" en período "2026-05"
  Cuando:    Intenta crear otra cuota para el mismo depto y período
  Entonces:  Retorna 409 Conflict con mensaje "Cuota ya existe para este período"
```

**Carga Masiva (Interfaz)**
```gherkin
CRITERIO-3.3: Carga masiva de cuotas por período
  Dado que:  El admin está en "Carga de Cuotas"
  Cuando:    Selecciona período "2026-05" e ingresa valores para 10 departamentos en una tabla editable
  Entonces:  Se guardan todos los registros en apartment_fees de una vez
             Retorna confirmación con cuenta de registros creados/actualizados
```

---

#### HU-04: ADMIN — Registro de Pagos (Parciales)

```
Como:        Administrador
Quiero:      Registrar pagos realizados por propietarios indicando monto, período y comprobante
Para:        Mantener un historial completo de ingresos y calcular saldos vencidos

Prioridad:   Alta
Estimación:  M
Dependencias: HU-03
Capa:        Backend + Frontend
```

##### Criterios de Aceptación — HU-04

**Happy Path — Registrar Pago**
```gherkin
CRITERIO-4.1: Crear pago para período y departamento
  Dado que:  Existe departamento "101", período "2026-05" con cuota 5000
  Cuando:    Admin registra pago de 2000 con método "transferencia" y adjunta comprobante
  Entonces:  Se crea payment con status="REGISTRADO"
             Retorna 201 con id, apartament_id, period, amount, paid_at, created_at
```

**Pagos Parciales — Múltiples en un período**
```gherkin
CRITERIO-4.2: Registrar múltiples pagos parciales en el mismo período
  Dado que:  Ya existe un pago de 2000 en período "2026-05" para depto "101"
  Cuando:    Admin registra otro pago de 2500 en el mismo período
  Entonces:  Ambos se registran (status=REGISTRADO)
             Al calcular saldo: Pagado total = 2000 + 2500 = 4500
```

**Anular Pago (No Eliminar)**
```gherkin
CRITERIO-4.3: Anular un pago existente sin borrarlo de BD
  Dado que:  Existe un pago con id "pay-123" y status="REGISTRADO"
  Cuando:    Admin lo marca como "Anular"
  Entonces:  El status cambia a "ANULADO"
             No se cuenta en cálculos de saldo (totales)
             El registro permanece en BD para auditoría
```

---

#### HU-05: ADMIN — Registro de Multas

```
Como:        Administrador
Quiero:      Registrar multas contra un departamento en un período específico con moto y valor manual
Para:        Agregar sanciones que incrementen la deuda del propietario

Prioridad:   Alta
Estimación:  M
Dependencias: HU-03
Capa:        Backend + Frontend
```

##### Criterios de Aceptación — HU-05

**Happy Path — Crear Multa**
```gherkin
CRITERIO-5.1: Registrar multa por incumplimiento
  Dado que:  Existe departamento "101", período "2026-05"
  Cuando:    Admin registra multa con amount=500, reason="Falta de pago anterior" y period="2026-05"
  Entonces:  Se crea fine con status="ACTIVA"
             Retorna 201
```

**Multa Afecta Saldo**
```gherkin
CRITERIO-5.2: Multa incrementa el saldo del período
  Dado que:  Período "2026-05" tiene Esperado=5000, Multas=0, Pagado=2000
  Cuando:    Se registra una multa de 500
  Entonces:  El nuevo Saldo = (5000 + 500) - 2000 = 3500
```

**Anular Multa**
```gherkin
CRITERIO-5.3: Anular multa existente
  Dado que:  Existe una multa con status="ACTIVA"
  Cuando:    Admin la marca como "Anular"
  Entonces:  Status cambia a "ANULADA"
             No se cuenta en cálculos de saldo
```

---

#### HU-06: ADMIN — Cálculo de Morosidad

```
Como:        Administrador
Quiero:      Visualizar el estado de morosidad de cada departamento/propietario
Para:        Identificar rápidamente los deudores y tomar acciones

Prioridad:   Alta
Estimación:  L
Dependencias: HU-03, HU-04, HU-05
Capa:        Backend + Frontend
```

##### Criterios de Aceptación — HU-06

**Regla de Cálculo**
```gherkin
CRITERIO-6.1: Calcular saldo y vencimiento por período
  Dado que:  Período "2026-04" tiene:
             - Esperado = 5000 (cuota)
             - Multas = 0
             - Pagado = 3000
             - Hoy es 21 de mayo (después del día 5)
  Cuando:    Se consulta el estado del período "2026-04"
  Entonces:  Saldo = (5000 + 0) - 3000 = 2000
             Status = "VENCIDO" (porque día > 5 y saldo > 0)
             La deuda se marca visible
```

**Estado de Morosidad por Propietario**
```gherkin
CRITERIO-6.2: Propietario en mora si existe al menos 1 período vencido con saldo > 0
  Dado que:  Propietario "Carlos" posee deptos "101", "102", "103"
             - Depto 101: período "2026-04" vencido, saldo = 1000 ✓
             - Depto 102: período "2026-05" no vencido, saldo = 0
             - Depto 103: período "2026-05" no vencido, saldo = 500 (no vencido aún)
  Cuando:    Se consulta estado del propietario "Carlos"
  Entonces:  Estado global = "EN MORA" (al menos 1 período vencido con deuda)
             Deuda total = 1000 (solo períodos vencidos con saldo > 0)
```

**Listar Morosos**
```gherkin
CRITERIO-6.3: Filtrar y listar propietarios en mora
  Dado que:  5 propietarios registrados, 2 en mora
  Cuando:    Admin consulta GET /api/v1/delinquency?status=OVERDUE
  Entonces:  Retorna lista de 2 propietarios con detalles:
             - Nombre, email, deuda_total, períodos_vencidos
```

---

#### HU-07: PROPIETARIO — Visualizar Estado de Cuenta

```
Como:        Propietario
Quiero:      Visualizar el estado consolidado de mis departamentos con balance de períodos
Para:        Conocer exactamente cuánto me falta pagar y en qué estado están mis cuentas

Prioridad:   Alta
Estimación:  M
Dependencias: HU-03, HU-04, HU-05
Capa:        Backend + Frontend
```

##### Criterios de Aceptación — HU-07

**Happy Path — Ver Estado de Cuenta**
```gherkin
CRITERIO-7.1: Propietario visualiza su estado de cuenta consolidado
  Dado que:  Propietario "Juan" posee deptos "101" y "102"
  Cuando:    Accede a "Mi Estado de Cuenta"
  Entonces:  Ve una tabla con columnas: Período | Depto | Esperado | Multas | Pagado | Saldo
             Muestra todos los períodos de sus departamentos (ej. 2026-03 a 2026-05)
             Columnas totalizadas: Esperado_total, Multas_total, Pagado_total, Saldo_total
```

**Filtro por Rango de Períodos**
```gherkin
CRITERIO-7.2: Filtrar estado de cuenta por rango de períodos
  Dado que:  Estado de cuenta disponible
  Cuando:    Selecciona período inicio="2026-03" y fin="2026-05"
  Entonces:  Se muestran solo esos 3 períodos
```

---

#### HU-08: ADMIN — Registro de Gastos

```
Como:        Administrador
Quiero:      Registrar gastos del edificio (servicios, mantenimiento, etc.)
Para:        Llevar control de egresos y calcular balances mensuales

Prioridad:   Media
Estimación:  M
Dependencias: Ninguna
Capa:        Backend + Frontend
```

##### Criterios de Aceptación — HU-08

**Happy Path — Crear Gasto**
```gherkin
CRITERIO-8.1: Registrar nuevo gasto
  Dado que:  Admin está en "Gastos"
  Cuando:    Ingresa fecha, proveedor, categoría (ej. "Servicios"), concepto, valor y comprobante
  Entonces:  Se crea expense con status="REGISTRADO"
             Retorna 201
```

**Listar Gastos**
```gherkin
CRITERIO-8.2: Listar gastos por período
  Dado que:  Existen 10 gastos en mayo 2026
  Cuando:    Consulta GET /api/v1/expenses?month=2026-05
  Entonces:  Retorna array de gastos filtrados con suma total
```

---

#### HU-09: ADMIN — Reportes PDF/Excel

```
Como:        Administrador
Quiero:      Exportar reportes de ingresos, gastos, balance y morosidad en PDF y Excel
Para:        Tener documentos formales para auditoría y análisis gerencial

Prioridad:   Alta
Estimación:  L
Dependencias: HU-04, HU-05, HU-06, HU-08
Capa:        Backend
```

##### Criterios de Aceptación — HU-09

**Reporte de Morosidad (PDF/Excel)**
```gherkin
CRITERIO-9.1: Generar reporte de morosidad
  Dado que:  Admin selecciona período "2026-05"
  Cuando:    Presiona "Descargar Reporte Morosidad - PDF"
  Entonces:  Se genera PDF con:
             - Título: "Reporte de Morosidad — Mayo 2026"
             - Tabla: Propietario | Departamento | Esperado | Multas | Pagado | Saldo | Estado
             - Totales al pie
             - Fecha de generación
```

**Reporte de Ingresos (PDF/Excel)**
```gherkin
CRITERIO-9.2: Generar reporte de ingresos mensuales
  Dado que:  Admin selecciona mes "2026-05"
  Cuando:    Presiona "Descargar Ingresos - Excel"
  Entonces:  Se genera Excel con:
             - Columnas: Fecha | Propietario | Departamento | Período | Monto | Método | Estado
             - Suma total por propietario
             - Suma general al pie
```

**Reporte de Balance (PDF)**
```gherkin
CRITERIO-9.3: Generar balance ingresos vs egresos
  Dado que:  Admin selecciona período "2026-05"
  Cuando:    Presiona "Descargar Balance - PDF"
  Entonces:  Se genera PDF con:
             - Ingresos (suma pagos registrados)
             - Egresos (suma gastos)
             - Balance neto
             - Deuda vencida (morosidad)
```

---

#### HU-10: PROPIETARIO — Descargar Estado de Cuenta (PDF/Excel)

```
Como:        Propietario
Quiero:      Descargar mi estado de cuenta en PDF o Excel
Para:        Tener un comprobante formal de mis movimientos

Prioridad:   Media
Estimación:  M
Dependencias: HU-07
Capa:        Backend + Frontend
```

##### Criterios de Aceptación — HU-10

**Happy Path — Descargar PDF**
```gherkin
CRITERIO-10.1: Descargar estado de cuenta en PDF
  Dado que:  Propietario está en "Mi Estado de Cuenta"
  Cuando:    Presiona "Descargar PDF"
  Entonces:  Se descarga PDF con:
             - Datos del propietario (nombre, email, documento)
             - Período seleccionado
             - Tabla: Período | Depto | Esperado | Multas | Pagado | Saldo
             - Nota legal: "Este documento es un extracto de su cuenta"
```

---

### Reglas de Negocio

1. **RN-01**: Todo pago y multa **debe** estar asociados a un `apartment_id` y a un `period (YYYY-MM)`.
2. **RN-02**: Un pago aplica exclusivamente a **un único período**. No se subdivide automáticamente.
3. **RN-03**: Los pagos pueden ser **parciales**; se suman al total pagado del período.
4. **RN-04**: Una multa incrementa el saldo esperado: `Saldo = (Esperado + Multas) - Pagado`.
5. **RN-05**: Un período se considera **vencido** si `hoy > due_day (default=5)` del mes del período **Y** `Saldo > 0`.
6. **RN-06**: Un propietario está **EN MORA** si al menos uno de sus departamentos tiene al menos un período vencido con `Saldo > 0`.
7. **RN-07**: Un `document_id` (propietario) es único en la BD. No se permiten duplicados.
8. **RN-08**: Un departamento tiene un único código dentro del edificio (único a nivel de edificio).
9. **RN-09**: Relación `owner_apartments` es **muchos a muchos**: un propietario puede tener N departamentos; un departamento (en futuro) puede tener N propietarios (copropiedad).
10. **RN-10**: Anulación de pagos y multas es lógica (no eliminar). El estado cambia a `ANULADO`.
11. **RN-11**: Si un departamento no tiene `apartment_fees` para un período, el Esperado = 0.
12. **RN-12**: Timestamps `created_at` y `updated_at` en UTC, formato ISO 8601.

---

### Modelos de Datos

#### Entidades principales

| Entidad | Almacén | Estado | Descripción |
|---------|---------|--------|-------------|
| `users` | PostgreSQL | existente | Usuarios autenticados (Firebase UID) |
| `owners` | PostgreSQL | nueva | Propietarios del edificio |
| `apartments` | PostgreSQL | nueva | Departamentos del edificio |
| `owner_apartments` | PostgreSQL | nueva | Relación muchos a muchos |
| `apartment_fees` | PostgreSQL | nueva | Histórico de cuotas por período |
| `payments` | PostgreSQL | nueva | Registro de pagos |
| `fines` | PostgreSQL | nueva | Registro de multas |
| `expenses` | PostgreSQL | nueva | Registro de gastos |
| `files` | PostgreSQL | nueva | Almacén de comprobantes (URL a S3/MinIO) |
| `settings` | PostgreSQL | nueva | Configuración global (día vencimiento, datos edificio) |

#### Schema PostgreSQL (DDL recomendado)

```sql
-- 1. OWNERS (Propietarios)
CREATE TABLE owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    document_id VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVO', -- ACTIVO, INACTIVO
    created_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. APARTMENTS (Departamentos)
CREATE TABLE apartments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    floor INT,
    tower VARCHAR(10),
    status VARCHAR(50) DEFAULT 'ACTIVO', -- ACTIVO, INACTIVO
    created_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. OWNER_APARTMENTS (Relación muchos a muchos)
CREATE TABLE owner_apartments (
    owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_id, apartment_id)
);

-- 4. APARTMENT_FEES (Cuotas por período)
CREATE TABLE apartment_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    period CHAR(7) NOT NULL, -- 'YYYY-MM' ej. '2026-05'
    amount DECIMAL(12, 2) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(apartment_id, period)
);

-- 5. PAYMENTS (Pagos)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    period CHAR(7) NOT NULL, -- 'YYYY-MM'
    paid_at DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    method VARCHAR(50), -- 'transferencia', 'efectivo', etc.
    reference VARCHAR(255),
    receipt_file_id UUID REFERENCES files(id),
    status VARCHAR(50) DEFAULT 'REGISTRADO', -- REGISTRADO, ANULADO
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. FINES (Multas)
CREATE TABLE fines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    period CHAR(7) NOT NULL,
    issued_at DATE NOT NULL,
    reason VARCHAR(255),
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVA', -- ACTIVA, ANULADA
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. EXPENSES (Gastos)
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    provider VARCHAR(255),
    category VARCHAR(100), -- 'Servicios', 'Mantenimiento', etc.
    concept VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    invoice_file_id UUID REFERENCES files(id),
    status VARCHAR(50) DEFAULT 'REGISTRADO',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. FILES (Almacén de comprobantes)
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key VARCHAR(255) NOT NULL, -- URL en S3/MinIO
    filename VARCHAR(255),
    mime_type VARCHAR(50),
    size BIGINT,
    created_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. SETTINGS (Configuración global)
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_name VARCHAR(255),
    building_address VARCHAR(255),
    due_day INT DEFAULT 5,
    created_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(0) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Índices recomendados
CREATE INDEX idx_owner_apartments_owner_id ON owner_apartments(owner_id);
CREATE INDEX idx_owner_apartments_apartment_id ON owner_apartments(apartment_id);
CREATE INDEX idx_apartment_fees_apartment_period ON apartment_fees(apartment_id, period);
CREATE INDEX idx_payments_apartment_period ON payments(apartment_id, period);
CREATE INDEX idx_payments_owner_id ON payments(owner_id);
CREATE INDEX idx_fines_apartment_period ON fines(apartment_id, period);
CREATE INDEX idx_fines_owner_id ON fines(owner_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_owners_document ON owners(document_id);
CREATE INDEX idx_apartments_code ON apartments(code);
```

---

### API Endpoints

#### Propietarios — ADMIN

**POST /api/v1/owners**
- Crear propietario
- Body: `{ "full_name": "string", "document_id": "string", "phone": "string?", "email": "string?" }`
- Response 201: propietario con uid
- Response 409: documento duplicado
- Auth: JWT (ADMIN)

**GET /api/v1/owners**
- Listar propietarios
- Query: opcional `?status=ACTIVO`
- Response 200: array de propietarios
- Auth: JWT (ADMIN)

**GET /api/v1/owners/{owner_id}**
- Obtener propietario con sus departamentos
- Response 200: { owner, apartments: [...] }
- Auth: JWT (ADMIN o PROPIETARIO=self)

**PUT /api/v1/owners/{owner_id}**
- Actualizar propietario
- Body: campos opcionales
- Response 200: propietario actualizado
- Auth: JWT (ADMIN)

**DELETE /api/v1/owners/{owner_id}**
- Marcar propietario como inactivo (soft delete)
- Response 204
- Auth: JWT (ADMIN)

---

#### Departamentos — ADMIN

**POST /api/v1/apartments**
- Crear departamento
- Body: `{ "code": "string", "floor": "int?", "tower": "string?" }`
- Response 201: departamento con uid
- Response 409: código duplicado
- Auth: JWT (ADMIN)

**GET /api/v1/apartments**
- Listar departamentos
- Response 200: array
- Auth: JWT (ADMIN)

**POST /api/v1/apartments/{apartment_id}/owners/{owner_id}**
- Asignar propietario a departamento
- Body: `{ "is_primary": "bool?" }`
- Response 201: relación creada
- Auth: JWT (ADMIN)

**DELETE /api/v1/apartments/{apartment_id}/owners/{owner_id}**
- Remover asignación
- Response 204
- Auth: JWT (ADMIN)

---

#### Cuotas por Período — ADMIN

**POST /api/v1/apartment-fees**
- Crear cuota para período
- Body: `{ "apartment_id": "uuid", "period": "YYYY-MM", "amount": "decimal" }`
- Response 201: apartament_fee con id
- Response 409: cuota ya existe para ese departamento-período
- Auth: JWT (ADMIN)

**POST /api/v1/apartment-fees/bulk**
- Carga masiva de cuotas por período
- Body: `{ "period": "YYYY-MM", "fees": [{ "apartment_id": "uuid", "amount": "decimal" }, ...] }`
- Response 201: { created: int, updated: int }
- Auth: JWT (ADMIN)

**GET /api/v1/apartment-fees?period=YYYY-MM**
- Listar cuotas para un período
- Response 200: array de apartment_fees
- Auth: JWT (ADMIN)

---

#### Pagos — ADMIN

**POST /api/v1/payments**
- Registrar pago
- Body: `{ "apartment_id": "uuid", "period": "YYYY-MM", "amount": "decimal", "method": "string?", "reference": "string?", "paid_at": "date" }`
- Response 201: payment con id
- Auth: JWT (ADMIN)

**GET /api/v1/payments?period=YYYY-MM&owner_id=uuid&status=REGISTRADO**
- Listar pagos
- Response 200: array
- Auth: JWT (ADMIN)

**PUT /api/v1/payments/{payment_id}**
- Anular pago (cambiar status a ANULADO)
- Response 200: payment actualizado
- Auth: JWT (ADMIN)

---

#### Multas — ADMIN

**POST /api/v1/fines**
- Registrar multa
- Body: `{ "apartment_id": "uuid", "period": "YYYY-MM", "amount": "decimal", "reason": "string", "issued_at": "date" }`
- Response 201: fine con id
- Auth: JWT (ADMIN)

**GET /api/v1/fines?period=YYYY-MM&status=ACTIVA**
- Listar multas
- Response 200: array
- Auth: JWT (ADMIN)

**PUT /api/v1/fines/{fine_id}**
- Anular multa (cambiar status a ANULADA)
- Response 200: fine actualizado
- Auth: JWT (ADMIN)

---

#### Morosidad — ADMIN

**GET /api/v1/delinquency?status=OVERDUE**
- Listar propietarios en mora con detalles
- Response 200: array con { owner, deuda_total, períodos_vencidos, departamentos }
- Auth: JWT (ADMIN)

**GET /api/v1/delinquency/detail/{owner_id}**
- Detalle de morosidad de un propietario
- Response 200: { owner, apartments: [{ apartment, periods: [{ period, esperado, multas, pagado, saldo, status }] }] }
- Auth: JWT (ADMIN)

---

#### Estado de Cuenta — PROPIETARIO

**GET /api/v1/account-statement?start_period=YYYY-MM&end_period=YYYY-MM**
- Obtener estado de cuenta del propietario autenticado
- Response 200: array de períodos con Período | Depto | Esperado | Multas | Pagado | Saldo
- Auth: JWT (PROPIETARIO)

**GET /api/v1/account-statement/export?format=pdf&start_period=YYYY-MM&end_period=YYYY-MM**
- Descargar estado de cuenta en PDF o Excel
- Response: file (application/pdf o application/vnd.ms-excel)
- Auth: JWT (PROPIETARIO)

---

#### Gastos — ADMIN

**POST /api/v1/expenses**
- Registrar gasto
- Body: `{ "date": "date", "provider": "string", "category": "string", "concept": "string", "amount": "decimal" }`
- Response 201: expense con id
- Auth: JWT (ADMIN)

**GET /api/v1/expenses?month=YYYY-MM**
- Listar gastos por período
- Response 200: array con suma total
- Auth: JWT (ADMIN)

---

#### Reportes — ADMIN

**GET /api/v1/reports/delinquency?period=YYYY-MM&format=pdf|excel**
- Descargar reporte de morosidad
- Response: file
- Auth: JWT (ADMIN)

**GET /api/v1/reports/income?period=YYYY-MM&format=pdf|excel**
- Descargar reporte de ingresos
- Response: file
- Auth: JWT (ADMIN)

**GET /api/v1/reports/balance?period=YYYY-MM&format=pdf**
- Descargar balance ingresos vs egresos
- Response: file
- Auth: JWT (ADMIN)

---

### Diseño Frontend

#### Páginas nuevas (ADMIN)

| Página | Ruta | Componentes principales | Protegida |
|--------|------|------------------------|-----------|
| Propietarios | `/admin/owners` | OwnersList, OwnerFormModal | JWT + ADMIN |
| Departamentos | `/admin/apartments` | ApartmentsList, ApartmentFormModal, AssignOwnerModal | JWT + ADMIN |
| Cuotas | `/admin/fees` | FeesGrid (tabla editable), BulkUploadModal | JWT + ADMIN |
| Pagos | `/admin/payments` | PaymentsList, PaymentFormModal, PaymentDetail | JWT + ADMIN |
| Multas | `/admin/fines` | FinesList, FineFormModal | JWT + ADMIN |
| Gastos | `/admin/expenses` | ExpensesList, ExpenseFormModal | JWT + ADMIN |
| Morosidad | `/admin/delinquency` | DelinquencyList, DelinquencyDetail | JWT + ADMIN |
| Reportes | `/admin/reports` | ReportBuilder (filtros + descarga PDF/Excel) | JWT + ADMIN |

#### Páginas nuevas (PROPIETARIO)

| Página | Ruta | Componentes principales | Protegida |
|--------|------|------------------------|-----------|
| Mis Departamentos | `/owner/apartments` | ApartmentCardList | JWT + PROPIETARIO |
| Estado de Cuenta | `/owner/account-statement` | StatementTable, DateRangePicker, ExportButton | JWT + PROPIETARIO |

#### Componentes reutilizables

| Componente | Archivo | Props principales |
|------------|---------|------------------|
| `Table` | `components/Table` | `data, columns, onEdit, onDelete, pagination` |
| `FormModal` | `components/FormModal` | `isOpen, title, fields, onSubmit, onClose` |
| `ConfirmDialog` | `components/ConfirmDialog` | `isOpen, message, onConfirm, onCancel` |
| `StatCard` | `components/StatCard` | `label, value, icon, color` |
| `DateRangePicker` | `components/DateRangePicker` | `start, end, onChange` |
| `FileUpload` | `components/FileUpload` | `onUpload, accept, maxSize` |
| `PeriodSelector` | `components/PeriodSelector` | `period, onChange` |

#### Services (API calls)

Todos los servicios usan `Authorization: Bearer {idToken}` en headers:

- `ownerService.ts` — CRUD owners
- `apartmentService.ts` — CRUD apartments, assign owners
- `apartmentFeeService.ts` — CRUD apartment_fees, bulk upload
- `paymentService.ts` — CRUD payments
- `fineService.ts` — CRUD fines
- `delinquencyService.ts` — get delinquency list, details
- `accountStatementService.ts` — get account statement, export PDF/Excel
- `expenseService.ts` — CRUD expenses
- `reportService.ts` — generate and download reports

#### Hooks/State Management

- `useOwners()` — hook CRUD owners
- `useApartments()` — hook CRUD apartments
- `usePayments()` — hook CRUD payments con estado
- `useDelinquency()` — hook para cálculos y filtros de morosidad
- `useAccountStatement()` — hook estado de cuenta con filtros

---

### Arquitectura y Dependencias

**Paquetes nuevos requeridos (Backend — FastAPI)**:
- `reportlab` o `weasyprint` — generación de PDF
- `openpyxl` — generación de Excel
- `python-multipart` — para upload de archivos
- `boto3` — integración S3 (si se usa)

**Paquetes nuevos requeridos (Frontend)**:
- Ninguno adicional (usar React + React Router v6 + CSS Modules existentes)

**Servicios externos**:
- S3 o MinIO — almacenamiento de comprobantes y reportes
- Firebase Auth — autenticación (UID + JWT)

**Impacto en punto de entrada**:
- Backend: Registrar routers en `app/main.py` (nuevos prefijos `/api/v1/owners`, `/api/v1/apartments`, etc.)
- Frontend: Registrar rutas en router principal

---

### Notas de Implementación

1. **Período en `YYYY-MM`**: Usar `char(7)` en BD para permitir búsquedas rápidas y comparaciones de rango.
2. **Soft Delete**: No eliminar propietarios, departamentos ni pagos; cambiar `status` a `INACTIVO` o `ANULADO`.
3. **Cálculo de Morosidad**: Hacer en backend mediante query que cruza `apartment_fees`, `payments`, `fines`. Considerar cachear el resultado para no calcular en cada request.
4. **Reportes**: Generar server-side usando templates HTML → PDF (weasyprint) o libraries de Excel. Guardar temporalmente o servir en stream.
5. **Comprobantes**: Almacenar en S3/MinIO con nombre único (ej. `{payment_id}_{filename}`). Guardar URL en `payments.receipt_file_id`.
6. **Validaciones**: En el servicio, no en la ruta. Ejemplo: `check_document_duplicate()`, `check_apartment_code_unique()`.
7. **Transacciones**: Usar transacciones en operaciones críticas (ej. registrar pago + anular otro simultáneamente).

---

## 3. LISTA DE TAREAS

> Checklist accionable para el Orchestrator, Backend Developer, Frontend Developer, Test Engineer y QA.

### Backend

#### Modelos Pydantic

- [ ] `OwnerCreate`, `OwnerUpdate`, `OwnerResponse`, `OwnerDocument` (MongoDB)
- [ ] `ApartmentCreate`, `ApartmentUpdate`, `ApartmentResponse`, `ApartmentDocument`
- [ ] `OwnerApartmentCreate`, `OwnerApartmentResponse`
- [ ] `ApartmentFeeCreate`, `ApartmentFeeUpdate`, `ApartmentFeeResponse`
- [ ] `PaymentCreate`, `PaymentUpdate`, `PaymentResponse`
- [ ] `FineCreate`, `FineUpdate`, `FineResponse`
- [ ] `ExpenseCreate`, `ExpenseUpdate`, `ExpenseResponse`
- [ ] `DelinquencyResponse`, `DelinquencyDetailResponse`, `StatementLineResponse`

#### Repositorio (Database Layer)

- [ ] `OwnerRepository` — CRUD + validar unicidad document_id
- [ ] `ApartmentRepository` — CRUD + validar unicidad code
- [ ] `OwnerApartmentRepository` — create, read, delete relación
- [ ] `ApartmentFeeRepository` — create, read, update fee por período
- [ ] `PaymentRepository` — create, read, soft delete (status=ANULADO)
- [ ] `FineRepository` — create, read, soft delete
- [ ] `ExpenseRepository` — create, read
- [ ] Índices en PostgreSQL (ver schema DDL arriba)

#### Servicios (Lógica de Negocio)

- [ ] `OwnerService` — validar duplicado, listar, obtener detalles con departamentos
- [ ] `ApartmentService` — CRUD departamentos
- [ ] `OwnerApartmentService` — asignar/remover propietario
- [ ] `ApartmentFeeService` — crear fee, bulk upload, listar por período
- [ ] `PaymentService` — registrar pago, anular, listar, validar período-depto
- [ ] `FineService` — registrar multa, anular, listar
- [ ] `ExpenseService` — registrar gasto, listar
- [ ] `DelinquencyService` — calcular saldo por período, determinar estado vencido, listar morosos
- [ ] `AccountStatementService` — calcular estado de cuenta por propietario y rango de períodos
- [ ] `ReportService` — generar PDFs/Excels (morosidad, ingresos, balance)

#### Rutas (HTTP Endpoints)

- [ ] `router_owners.py` — POST, GET, GET/{id}, PUT/{id}, DELETE/{id}
- [ ] `router_apartments.py` — POST, GET, GET/{id}, POST/{id}/owners/{owner_id}, DELETE/{id}/owners/{owner_id}
- [ ] `router_fees.py` — POST, POST/bulk, GET?period=YYYY-MM
- [ ] `router_payments.py` — POST, GET, PUT/{id} (anular)
- [ ] `router_fines.py` — POST, GET, PUT/{id} (anular)
- [ ] `router_expenses.py` — POST, GET?month=YYYY-MM
- [ ] `router_delinquency.py` — GET (lista), GET/{owner_id} (detalle)
- [ ] `router_account_statement.py` — GET (JSON), GET/export?format=pdf|excel
- [ ] `router_reports.py` — GET/delinquency, GET/income, GET/balance?format=pdf|excel
- [ ] Registrar todos los routers en `app/main.py`

#### Tests Backend

- [ ] `test_owner_service_create_success`
- [ ] `test_owner_service_duplicate_document_raises_409`
- [ ] `test_apartment_service_duplicate_code_raises_409`
- [ ] `test_payment_service_register_success`
- [ ] `test_payment_service_anular_changes_status`
- [ ] `test_delinquency_service_calculate_balance`
- [ ] `test_delinquency_service_mark_overdue_if_after_day_5`
- [ ] `test_account_statement_service_calculate_totals`
- [ ] `test_router_post_owners_returns_201`
- [ ] `test_router_post_owners_returns_401_no_token`
- [ ] `test_router_post_payments_returns_201`
- [ ] `test_router_get_delinquency_returns_200`
- [ ] `test_report_service_generate_delinquency_pdf`
- [ ] `test_report_service_generate_income_excel`

### Frontend

#### Páginas ADMIN

- [ ] `AdminOwnersPage.jsx` — listar, crear, editar, eliminar propietarios
- [ ] `AdminApartmentsPage.jsx` — listar departamentos, asignar propietarios
- [ ] `AdminFeesPage.jsx` — tabla editable de cuotas por período, bulk upload modal
- [ ] `AdminPaymentsPage.jsx` — listar/crear pagos, anular, adjuntar comprobante
- [ ] `AdminFinesPage.jsx` — listar/crear multas, anular
- [ ] `AdminExpensesPage.jsx` — listar/crear gastos
- [ ] `AdminDelinquencyPage.jsx` — listar morosos, detalle por propietario
- [ ] `AdminReportsPage.jsx` — builder de reportes (filtros + descarga)

#### Páginas PROPIETARIO

- [ ] `OwnerApartmentsPage.jsx` — mis departamentos (estado al día / en mora)
- [ ] `OwnerAccountStatementPage.jsx` — estado de cuenta con rango de fechas, exportar PDF/Excel

#### Componentes

- [ ] `Table.jsx` — tabla reutilizable con paginación
- [ ] `FormModal.jsx` — modal de formulario genérico
- [ ] `ConfirmDialog.jsx` — diálogo de confirmación
- [ ] `FileUpload.jsx` — drag-drop o file picker para comprobantes
- [ ] `DateRangePicker.jsx` — selector de rango de fechas/períodos
- [ ] `PeriodSelector.jsx` — dropdown/input de período (YYYY-MM)
- [ ] `StatCard.jsx` — tarjeta de estadística (reutilizable del dashboard)
- [ ] `DelinquencyBadge.jsx` — badge visual para estado (AL DÍA / EN MORA)

#### Services (API)

- [ ] `ownerService.ts` — getAll, create, update, delete
- [ ] `apartmentService.ts` — getAll, create, assignOwner, removeOwner
- [ ] `apartmentFeeService.ts` — create, bulkUpload, getByPeriod
- [ ] `paymentService.ts` — create, getAll, anular
- [ ] `fineService.ts` — create, getAll, anular
- [ ] `expenseService.ts` — create, getByMonth
- [ ] `delinquencyService.ts` — getDelinquentOwners, getOwnerDetails
- [ ] `accountStatementService.ts` — getStatement, exportPDF, exportExcel
- [ ] `reportService.ts` — getDelinquencyReport, getIncomeReport, getBalanceReport

#### Hooks

- [ ] `useOwners()` — CRUD state + loading/error
- [ ] `useApartments()` — CRUD state
- [ ] `usePayments()` — CRUD state con filtros
- [ ] `useDelinquency()` — fetch + memoized calculations
- [ ] `useAccountStatement()` — fetch + date range filter

#### Tests Frontend

- [ ] `test_OwnersList_renders_table_with_owners`
- [ ] `test_OwnerFormModal_submit_creates_owner`
- [ ] `test_PaymentsPage_filter_by_period`
- [ ] `test_DelinquencyPage_display_overdue_mark`
- [ ] `test_AccountStatementPage_export_pdf_triggers_download`

### Database

#### DDL Creación de Tablas

- [ ] Crear script `migrations/001_create_gestion_edificios_schema.sql`
- [ ] Incluir todas las 10 tablas (owners, apartments, owner_apartments, apartment_fees, payments, fines, expenses, files, settings)
- [ ] Crear índices (ver lista arriba)
- [ ] Aplicar restricciones (UNIQUE, NOT NULL, FK)

#### Seed Data (Opcional — facilita testing)

- [ ] Script con 3 propietarios de ejemplo
- [ ] 6 departamentos de ejemplo
- [ ] Cuotas para 3 períodos
- [ ] 5 pagos parciales de ejemplo
- [ ] 2 multas de ejemplo
- [ ] 3 gastos de ejemplo

### QA / Testing Integration

#### Test Scenarios (Gherkin — opcional para QA)

- [ ] HU-01 — CRUD Propietarios (happy path + error cases)
- [ ] HU-02 — Asignar propietarios a departamentos
- [ ] HU-03 — Cargar cuotas por período (masivo)
- [ ] HU-04 — Registrar pagos parciales
- [ ] HU-06 — Cálculo de morosidad y vencimiento
- [ ] HU-07 — Estado de cuenta filtrado
- [ ] HU-09 — Generar y descargar reportes PDF/Excel
- [ ] HU-10 — Propietario descarga su estado de cuenta

#### Pruebas de Performance (Opcional)

- [ ] Tiempo de cálculo de morosidad con 1000 departamentos
- [ ] Generación de reporte PDF con 5000 registros
- [ ] Bulk upload de 500 cuotas

---

## Status

- **Creado**: 2026-05-21
- **Última actualización**: 2026-05-21
- **Próximo paso**: Revisar spec, cambiar status a `APPROVED`, iniciar implementación ASDD Fase 2 (Backend + Frontend).