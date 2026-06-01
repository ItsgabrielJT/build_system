---
id: SPEC-009
status: APPROVED
feature: balance-mensual-edificio
created: 2026-05-31
updated: 2026-05-31
author: spec-generator
version: "1.0"
related-specs: ["rediseno-gestion-cuotas", "rediseno-modulo-gastos", "mejoras-criticas-s2"]
---

# Spec: Balance Mensual del Edificio

> **Estado:** `APPROVED` → lista para iniciar implementación.
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED → DEPRECATED

---

## 1. REQUERIMIENTOS

### Descripción
Se incorporará una vista de balance mensual del edificio para ADMIN y PROPIETARIO con ingresos, gastos y balance neto del mes. La funcionalidad debe apoyarse en la contabilidad ya registrada por pagos y gastos para mantener coherencia con reportes y dashboards existentes.

### Requerimiento de Negocio
El ADMIN necesita consultar la salud financiera mensual del edificio desde un resumen consolidado con detalle operativo. El PROPIETARIO necesita visibilidad del balance mensual del edificio desde una vista autorizada, sin modificar datos ni ejecutar acciones administrativas.

### Historias de Usuario

#### HU-01: Consultar balance mensual como administrador

```
Como:        Administrador
Quiero:      consultar el balance mensual consolidado del edificio con ingresos, gastos y balance neto
Para:        monitorear la contabilidad mensual y tomar decisiones operativas

Prioridad:   Alta
Estimación:  M
Dependencias: Ninguna
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-01

**Happy Path**
```gherkin
CRITERIO-1.1: Cargar resumen mensual
  Dado que:  soy un ADMIN autenticado
  Cuando:    consulto un mes válido
  Entonces:  el sistema retorna ingresos, gastos y balance neto del mes
             y la interfaz muestra tarjetas resumen y desglose principal
```

```gherkin
CRITERIO-1.2: Mostrar tendencia mensual
  Dado que:  existen datos de meses previos
  Cuando:    consulto el balance del mes actual
  Entonces:  la interfaz muestra comparativo contra el mes anterior
             para ingresos, gastos y balance neto
```

**Error Path**
```gherkin
CRITERIO-1.3: Rechazar período inválido
  Dado que:  intento consultar el balance mensual
  Cuando:    envío un período con formato inválido
  Entonces:  el sistema responde 400 con mensaje de validación
```

#### HU-02: Consultar balance mensual como propietario

```
Como:        Propietario
Quiero:      visualizar el balance mensual del edificio en una vista de solo lectura
Para:        conocer el comportamiento general de ingresos y gastos del edificio

Prioridad:   Alta
Estimación:  M
Dependencias: HU-01
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-02

**Happy Path**
```gherkin
CRITERIO-2.1: Ver balance autorizado
  Dado que:  soy un PROPIETARIO autenticado
  Cuando:    consulto el balance mensual del edificio
  Entonces:  veo ingresos, gastos y balance neto del mes en modo solo lectura
             y no tengo acceso a acciones administrativas
```

**Error Path**
```gherkin
CRITERIO-2.2: Restringir datos no autorizados
  Dado que:  soy un PROPIETARIO autenticado
  Cuando:    intento acceder a un endpoint administrativo de balance
  Entonces:  el sistema responde 403
             y mantiene disponibles solo los endpoints autorizados para mi rol
```

#### HU-03: Consistencia contable entre vistas y reportes

```
Como:        Administrador
Quiero:      que el balance mensual coincida con reportes y dashboard
Para:        evitar diferencias entre vistas financieras del sistema

Prioridad:   Alta
Estimación:  S
Dependencias: HU-01
Capa:        Backend
```

#### Criterios de Aceptación — HU-03

**Happy Path**
```gherkin
CRITERIO-3.1: Reutilizar fuentes contables
  Dado que:  existen pagos y gastos válidos en el período consultado
  Cuando:    el sistema calcula el balance mensual
  Entonces:  usa la misma base contable de pagos aprobados y gastos activos
             y los totales coinciden con reportes del mismo período
```

### Reglas de Negocio
1. El balance neto mensual se calcula como ingresos confirmados menos gastos válidos del mes.
2. Los ingresos deben considerar solo pagos aprobados o confirmados según el estado final definido en pagos.
3. Los gastos deben considerar únicamente registros activos y no anulados.
4. ADMIN y PROPIETARIO tienen acceso de solo lectura al balance mensual por sus endpoints autorizados.
5. La misma lógica de cálculo debe alimentar dashboard, reportes descargables y vistas UI.
6. El período se expresa en formato YYYY-MM.

---

## 2. DISEÑO

### Modelos de Datos

#### Entidades afectadas
| Entidad | Almacén | Cambios | Descripción |
|---------|---------|---------|-------------|
| `Payment` | tabla `payments` | consultada | Fuente de ingresos confirmados/aprobados |
| `Expense` | tabla `expenses` | consultada | Fuente de gastos del mes |
| `MonthlyBalanceView` | servicio/DTO | nueva | Modelo derivado para exponer el balance mensual |

#### Campos del modelo
| Campo | Tipo | Obligatorio | Validación | Descripción |
|-------|------|-------------|------------|-------------|
| `period` | string | sí | formato YYYY-MM | Mes consultado |
| `income_total` | decimal | sí | >= 0 | Total de ingresos del mes |
| `expense_total` | decimal | sí | >= 0 | Total de gastos del mes |
| `net_balance` | decimal | sí | derivado | Resultado income_total - expense_total |
| `income_breakdown` | array | no | serializable | Desglose de ingresos por origen |
| `expense_breakdown` | array | no | serializable | Desglose de gastos por categoría |
| `previous_period_variation` | object | no | derivado | Variación vs mes anterior |

#### Índices / Constraints
- Reusar índices existentes de `payments(period, status)` y `expenses(date/status)` para consultas mensuales.
- Si el rendimiento no es suficiente, evaluar índice compuesto adicional sobre mes derivado de fecha de gasto.

### API Endpoints

#### GET /api/v1/reports/monthly-balance
- **Descripción**: Devuelve el balance mensual para ADMIN.
- **Auth requerida**: sí, rol ADMIN.
- **Query Params**: `period` opcional, default = mes actual.
- **Response 200**:
  ```json
  {
    "period": "2026-05",
    "income_total": 2500.0,
    "expense_total": 1750.0,
    "net_balance": 750.0,
    "income_breakdown": [{ "label": "Cuotas", "amount": 2300.0 }],
    "expense_breakdown": [{ "label": "Mantenimiento", "amount": 900.0 }],
    "previous_period_variation": {
      "income_pct": 4.2,
      "expense_pct": -1.5,
      "net_balance_pct": 12.1
    }
  }
  ```
- **Response 400**: período inválido.
- **Response 403**: usuario no autorizado.

#### GET /api/v1/owner/monthly-balance
- **Descripción**: Devuelve el balance mensual autorizado para PROPIETARIO.
- **Auth requerida**: sí, rol PROPIETARIO.
- **Query Params**: `period` opcional.
- **Response 200**: mismo contrato base con campos autorizados para owner.

### Diseño Frontend

#### Componentes nuevos
| Componente | Archivo | Props principales | Descripción |
|------------|---------|------------------|-------------|
| `MonthlyBalanceCards` | `components/MonthlyBalanceCards/MonthlyBalanceCards.jsx` | `summary` | Tarjetas de ingresos, gastos y neto |
| `MonthlyBalanceChart` | `components/MonthlyBalanceChart/MonthlyBalanceChart.jsx` | `series` | Visualización comparativa del mes |

#### Páginas nuevas
| Página | Archivo | Ruta | Protegida |
|--------|---------|------|-----------|
| `OwnerMonthlyBalancePage` | `pages/owner/OwnerMonthlyBalancePage.jsx` | `/owner/monthly-balance` | sí |

#### Páginas modificadas
| Página | Archivo | Ruta | Cambio |
|--------|---------|------|--------|
| `AdminReportsPage` | `pages/admin/AdminReportsPage.jsx` | `/admin/reports` | incorpora resumen y consulta mensual |

#### Hooks y State
| Hook | Archivo | Retorna | Descripción |
|------|---------|---------|-------------|
| `useMonthlyBalance` | `hooks/useMonthlyBalance.js` | `{ data, loading, error, reload }` | Consulta del balance mensual según rol |

#### Services (llamadas API)
| Función | Archivo | Endpoint |
|---------|---------|---------|
| `getAdminMonthlyBalance(period, token)` | `services/reportService.js` | `GET /api/v1/reports/monthly-balance` |
| `getOwnerMonthlyBalance(period, token)` | `services/reportService.js` | `GET /api/v1/owner/monthly-balance` |

### Arquitectura y Dependencias
- Reutilizar `ReportService`, `PaymentRepository` y `ExpenseRepository` para evitar reglas duplicadas.
- No se crean acciones mutables; solo lectura y agregación.
- El frontend debe exponer la ruta owner en `App.jsx` y en el sidebar del PROPIETARIO.

### Notas de Implementación
> Si el módulo de pagos con aprobación redefine el estado contable válido, este spec debe consumir ese estado final en todos los cálculos. La visibilidad del PROPIETARIO debe ser validada con negocio antes de exponer detalles por categoría sensibles.

---

## 3. LISTA DE TAREAS

> Checklist accionable para todos los agentes. Marcar cada ítem (`[x]`) al completarlo.
> El Orchestrator monitorea este checklist para determinar el progreso.

### Backend

#### Implementación
- [ ] Definir DTO/schema de respuesta para balance mensual
- [ ] Implementar agregación mensual en servicio de reportes
- [ ] Exponer endpoint admin de balance mensual
- [ ] Exponer endpoint owner de balance mensual
- [ ] Asegurar consistencia con reportes y métricas existentes

#### Tests Backend
- [ ] `test_monthly_balance_admin_success`
- [ ] `test_monthly_balance_owner_success`
- [ ] `test_monthly_balance_invalid_period_returns_400`
- [ ] `test_monthly_balance_excludes_unapproved_income`
- [ ] `test_monthly_balance_excludes_annulled_expenses`

### Frontend

#### Implementación
- [ ] Extender `reportService` con endpoints de balance mensual
- [ ] Crear `useMonthlyBalance`
- [ ] Implementar `MonthlyBalanceCards` y `MonthlyBalanceChart`
- [ ] Extender `AdminReportsPage` con consulta mensual
- [ ] Implementar `OwnerMonthlyBalancePage`
- [ ] Registrar ruta y navegación para PROPIETARIO

#### Tests Frontend
- [ ] `AdminReportsPage renders monthly balance summary`
- [ ] `OwnerMonthlyBalancePage renders readonly monthly balance`
- [ ] `useMonthlyBalance handles api error`

### QA
- [ ] Ejecutar skill `/gherkin-case-generator` para HU-01, HU-02 y HU-03
- [ ] Ejecutar skill `/risk-identifier` para cálculos, permisos y consistencia contable
- [ ] Verificar consistencia entre dashboard, balance y reportes exportables
- [ ] Actualizar estado spec: `status: IMPLEMENTED`