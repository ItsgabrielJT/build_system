---
id: SPEC-001
status: DRAFT
feature: rediseno-modulo-gastos
created: 2026-05-21
updated: 2026-05-21
author: spec-generator
version: "1.0"
related-specs: []
---

# Spec: Rediseño del Módulo de Gastos

> **Estado:** `DRAFT` → Aprobar con `status: APPROVED` antes de iniciar implementación.
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED → DEPRECATED

---

## 1. REQUERIMIENTOS

### Descripción

Rediseñar completamente la página de administración de gastos (AdminExpensesPage) para mostrar un dashboard ejecutivo con estadísticas de presupuesto, gráficas de tendencias y un formulario inline de registro de gastos. El nuevo diseño incluye dos tarjetas de KPIs (gasto del mes actual vs presupuesto; gasto de Mantenimiento vs presupuesto de categoría), un formulario inline en columna izquierda, panel de gastos recientes en columna derecha, y dos gráficas (gastos por categoría y evolución mensual).

### Requerimiento de Negocio (Original)

Rediseñar el módulo de gastos (AdminExpensesPage) para que tenga el siguiente diseño y funcionalidades:

**Layout objetivo:**
1. Header con título "Expense Registry", subtítulo y botón "Generate Report"
2. Dos tarjetas de estadísticas en la parte superior:
   - "Current Month Spend": monto total del mes actual vs presupuesto mensual configurado, barra de progreso % utilizado
   - "Maintenance & Repairs": gasto de la categoría Mantenimiento del mes vs presupuesto de esa categoría, alerta "Over Budget" si se excede
3. Layout de dos columnas:
   - Columna izquierda: formulario inline "Record New Expense" (no modal) con campos: Payee/Vendor, Category (select), Date, Amount, Description (textarea), Receipt/Invoice (área drag & drop para subir archivo)
   - Columna derecha: panel "Recent Expenses" con lista de últimos 10 gastos (nombre concepto, proveedor, monto negativo, fecha, ícono por categoría)
4. Sección de gráficas debajo del layout principal:
   - Gráfica de barras: gastos por categoría del mes actual
   - Gráfica de línea: evolución de gastos totales últimos 6 meses

**APIs backend nuevas necesarias:**
1. `GET /expenses/stats/monthly` — Devuelve: total_spend, budget, percentage_used, categories (array de {category, amount, budget}) para el mes actual o el mes especificado via query param `month`
2. `GET /expenses/stats/chart` — Devuelve: by_category (array {category, amount}) y monthly_trend (array {month: "YYYY-MM", total}) para los últimos 6 meses

**Conservar funcionalidad existente:**
- `GET /expenses?month=YYYY-MM` — listar gastos por mes
- `POST /expenses` — crear gasto (ahora el form es inline, no modal)

**Nota sobre presupuestos:** Los presupuestos son valores estáticos configurables como constante en el backend (no tabla de DB). Budget total mensual = $15,000, budget Mantenimiento = $3,500 (configurables en settings).

### Historias de Usuario

#### HU-01: Ver estadísticas de presupuesto mensual

```
Como:        Administrador del edificio
Quiero:      Ver una tarjeta con el gasto total del mes actual vs el presupuesto configurado
Para:        Entender rápidamente si el mes está dentro de presupuesto y qué % se ha utilizado

Prioridad:   Alta
Estimación:  S
Dependencias: Ninguna
Capa:        Frontend + Backend
```

#### Criterios de Aceptación — HU-01

**Happy Path**
```gherkin
CRITERIO-1.1: Mostrar estadísticas mensuales correctamente
  Dado que:  El endpoint /expenses/stats/monthly devuelve datos válidos
  Cuando:    El usuario carga la página AdminExpensesPage
  Entonces:  Se muestra la tarjeta "Current Month Spend" con:
             - Monto total de gastos del mes: $X,XXX.XX
             - Presupuesto configurado: $15,000.00
             - Porcentaje utilizado: XX% con barra visual de progreso
             - Color verde si <= 80%, amarillo si 80-100%, rojo si > 100%
```

**Error Path**
```gherkin
CRITERIO-1.2: Manejar error en la API de estadísticas mensuales
  Dado que:  El endpoint /expenses/stats/monthly retorna error 500
  Cuando:    El usuario carga la página
  Entonces:  Se muestra un banner de error amigable sin romper la página
             y se intenta reintentar la carga automáticamente cada 5 segundos
```

#### HU-02: Ver alerta de presupuesto por categoría (Mantenimiento)

```
Como:        Administrador del edificio
Quiero:      Ver una tarjeta dedicada al presupuesto de Mantenimiento & Repairs
Para:        Alertarme si los gastos de mantenimiento se están saliendo del presupuesto

Prioridad:   Alta
Estimación:  S
Dependencias: HU-01
Capa:        Frontend + Backend
```

#### Criterios de Aceptación — HU-02

**Happy Path**
```gherkin
CRITERIO-2.1: Mostrar tarjeta de Mantenimiento con estado normal
  Dado que:  El gasto de Mantenimiento del mes es $2,500 y el presupuesto es $3,500
  Cuando:    El usuario ve la tarjeta "Maintenance & Repairs"
  Entonces:  Se muestra:
             - Título "Maintenance & Repairs"
             - Gasto: $2,500.00
             - Presupuesto: $3,500.00
             - Estatus: "Within Budget" (verde)
             - Barra de progreso al 71%

CRITERIO-2.2: Mostrar alerta de sobregasto
  Dado que:  El gasto de Mantenimiento del mes es $4,200 y el presupuesto es $3,500
  Cuando:    El usuario ve la tarjeta "Maintenance & Repairs"
  Entonces:  Se muestra:
             - Alerta visual "Over Budget" en rojo
             - Diferencia: +$700.00 (monto excedido)
             - Barra de progreso al 120% con color rojo
```

#### HU-03: Registrar nuevo gasto con formulario inline

```
Como:        Administrador del edificio
Quiero:      Registrar un nuevo gasto directamente en el formulario inline sin usar modal
Para:        Mejorar la fluidez del flujo de registro y mantener contexto visual de gastos recientes

Prioridad:   Alta
Estimación:  M
Dependencias: Ninguna
Capa:        Frontend + Backend
```

#### Criterios de Aceptación — HU-03

**Happy Path**
```gherkin
CRITERIO-3.1: Enviar formulario inline válido
  Dado que:  El usuario está en la columna izquierda "Record New Expense"
  Cuando:    Completa todos los campos obligatorios (Vendor, Category, Date, Amount)
             y hace clic en "Submit" o "Save"
  Entonces:  La API POST /expenses es llamada con los datos
             y el gasto aparece inmediatamente en el panel "Recent Expenses" (derecha)
             y el formulario se limpia

CRITERIO-3.2: Mostrar validaciones en tiempo real
  Dado que:  El usuario está rellenando el formulario
  Cuando:    Deja un campo requerido vacío o ingresa un valor inválido (ej. monto negativo)
  Entonces:  Se muestra un mensaje de error específico bajo el campo
             y el botón "Submit" permanece deshabilitado
```

**Error Path**
```gherkin
CRITERIO-3.3: Manejar error en la creación de gasto
  Dado que:  El usuario presiona "Submit" en el formulario
  Cuando:    La API retorna error 400 o 500
  Entonces:  Se muestra un banner de error sin limpiar el formulario
             permitiendo al usuario corregir y reintentar
```

**Edge Case**
```gherkin
CRITERIO-3.4: Formulario con textarea de descripción
  Dado que:  El usuario ingresa una descripción larga (> 500 caracteres)
  Cuando:    Presiona "Submit"
  Entonces:  La descripción se trunca a 500 caracteres y se registra el gasto
             sin errores
```

#### HU-04: Ver últimos gastos registrados en panel "Recent Expenses"

```
Como:        Administrador del edificio
Quiero:      Ver los últimos 10 gastos registrados en un panel en la columna derecha
Para:        Validar rápidamente que el gasto que acabo de registrar está en la lista
             y ver un resumen visual de gastos recientes

Prioridad:   Media
Estimación:  S
Dependencias: HU-03
Capa:        Frontend + Backend
```

#### Criterios de Aceptación — HU-04

**Happy Path**
```gherkin
CRITERIO-4.1: Mostrar últimos 10 gastos ordenados por fecha descendente
  Dado que:  Existen 25 gastos en la base de datos del mes actual
  Cuando:    El usuario carga la página
  Entonces:  El panel "Recent Expenses" muestra exactamente 10 registros
             ordenados de más reciente a más antiguo
             con: concepto, proveedor, monto (en rojo, formato -$X,XXX.XX), 
                  fecha, ícono de categoría

CRITERIO-4.2: Actualizar lista al registrar nuevo gasto
  Dado que:  El usuario acaba de registrar un gasto mediante el formulario inline
  Cuando:    El gasto se crea exitosamente
  Entonces:  El nuevo gasto aparece en la posición #1 del panel "Recent Expenses"
             sin recargar la página
```

#### HU-05: Ver gráficas de gastos por categoría y evolución mensual

```
Como:        Administrador del edificio
Quiero:      Ver dos gráficas: gastos por categoría del mes y evolución mensual 6 meses
Para:        Analizar patrones de gasto y tendencias a lo largo del tiempo

Prioridad:   Media
Estimación:  M
Dependencias: Ninguna
Capa:        Frontend + Backend
```

#### Criterios de Aceptación — HU-05

**Happy Path**
```gherkin
CRITERIO-5.1: Mostrar gráfica de barras por categoría
  Dado que:  El endpoint /expenses/stats/chart devuelve by_category con datos
  Cuando:    El usuario ve la sección de gráficas
  Entonces:  Se muestra una gráfica de barras (Recharts BarChart) con:
             - Eje X: nombres de categorías (Servicios, Mantenimiento, Seguridad, etc.)
             - Eje Y: montos en USD
             - Colores diferenciados por categoría
             - Tooltip con monto exacto al pasar mouse
             - Responsive (se adapta a pantalla)

CRITERIO-5.2: Mostrar gráfica de línea con evolución 6 meses
  Dado que:  El endpoint devuelve monthly_trend con últimos 6 meses
  Cuando:    El usuario ve la sección de gráficas
  Entonces:  Se muestra una gráfica de línea (Recharts LineChart) con:
             - Eje X: 6 últimos meses en formato YYYY-MM
             - Eje Y: gasto total mensual en USD
             - Línea azul con puntos interactivos
             - Tooltip con mes y monto exacto
             - Responsive
```

#### HU-06: Botón "Generate Report" (placeholder)

```
Como:        Administrador del edificio
Quiero:      Que haya un botón "Generate Report" en el header
Para:        Preparar la interfaz para futuras funcionalidades de exportación

Prioridad:   Baja
Estimación:  XS
Dependencias: Ninguna
Capa:        Frontend
```

#### Criterios de Aceptación — HU-06

**Happy Path**
```gherkin
CRITERIO-6.1: Mostrar botón en header
  Dado que:  El usuario está en AdminExpensesPage
  Cuando:    Ve el header
  Entonces:  Existe un botón "Generate Report" visible al lado de otros controles
             (por ahora es placeholder y puede mostrar toast "Coming soon")
```

### Reglas de Negocio

1. **Presupuesto mensual fijo**: El presupuesto total mensual es $15,000 USD. Configurable en `backend/app/config/settings.py` como `BUDGET_MONTHLY = 15000`.
2. **Presupuesto por categoría**: La categoría "Mantenimiento" tiene presupuesto de $3,500 USD. Configurable en settings como `BUDGET_MAINTENANCE = 3500`.
3. **Cálculo de porcentaje**: `percentage_used = (total_spend / budget) * 100`. Si excede 100%, se muestra alerta "Over Budget".
4. **Últimos 10 gastos**: El panel "Recent Expenses" siempre muestra máximo 10 registros, ordenados por fecha descendente (más reciente primero).
5. **Evolución 6 meses**: La gráfica de línea incluye exactamente los últimos 6 meses calendario (mes actual + 5 meses anteriores).
6. **Montos de gastos se muestran negativos**: En el panel "Recent Expenses", los montos se muestran con signo negativo (ej. -$250.00) para indicar que son egresos.
7. **Solo Admin puede ver/crear**: Todos los endpoints de gastos requieren rol "admin".
8. **No cambios de BD**: No se crean nuevas tablas ni se modifican estructuras existentes. Los presupuestos son constantes en settings.

---

## 2. DISEÑO

### Modelos de Datos

#### Entidades afectadas
| Entidad | Almacén | Cambios | Descripción |
|---------|---------|---------|-------------|
| `Expense` | tabla `expenses` (PostgreSQL) | **Sin cambios** | Estructura existente: id, date, provider, category, concept, amount, status, created_by, created_at |
| `BudgetConfig` | `backend/app/config/settings.py` | **Nuevo (constantes)** | Configuración de presupuestos: BUDGET_MONTHLY, BUDGET_MAINTENANCE |

#### Campos del modelo Expense (existente, sin cambios)
| Campo | Tipo | Obligatorio | Validación | Descripción |
|-------|------|-------------|------------|-------------|
| `id` | UUID | sí | auto-generado | Identificador único |
| `date` | DATE | sí | ISO 8601 | Fecha del gasto |
| `provider` | VARCHAR(255) | no | max 255 chars | Proveedor/Vendor |
| `category` | VARCHAR(50) | no | enum (Servicios, Mantenimiento, Seguridad, Limpieza, Administración, Otros) | Categoría del gasto |
| `concept` | VARCHAR(255) | sí | max 255 chars | Concepto/descripción breve |
| `amount` | DECIMAL(12,2) | sí | > 0 | Monto del gasto |
| `status` | VARCHAR(20) | sí | DEFAULT 'ACTIVO' | Estado del registro |
| `created_by` | VARCHAR(255) | sí | UID del usuario | Usuario que registró el gasto |
| `created_at` | TIMESTAMPTZ | sí | auto-generado UTC | Timestamp de creación |

#### Nuevas Constantes en Settings
```python
# backend/app/config/settings.py
BUDGET_MONTHLY: Decimal = Decimal("15000.00")  # Presupuesto mensual total
BUDGET_MAINTENANCE: Decimal = Decimal("3500.00")  # Presupuesto categoría Mantenimiento
```

### API Endpoints

#### GET /expenses/stats/monthly
- **Descripción**: Obtiene estadísticas de presupuesto mensual
- **Auth requerida**: sí (admin)
- **Query Parameters**:
  - `month` (opcional): formato YYYY-MM. Si no se proporciona, usa mes actual
- **Response 200**:
  ```json
  {
    "total_spend": 12500.50,
    "budget": 15000.00,
    "percentage_used": 83.34,
    "month": "2026-05",
    "categories": [
      {
        "category": "Mantenimiento",
        "amount": 2800.00,
        "budget": 3500.00,
        "percentage_used": 80.00
      },
      {
        "category": "Servicios",
        "amount": 5600.25,
        "budget": null
      },
      {
        "category": "Seguridad",
        "amount": 2100.00,
        "budget": null
      },
      {
        "category": "Otros",
        "amount": 2000.25,
        "budget": null
      }
    ]
  }
  ```
- **Response 401**: Token ausente o expirado
- **Response 403**: Usuario no tiene rol admin
- **Response 500**: Error interno del servidor

#### GET /expenses/stats/chart
- **Descripción**: Obtiene datos para gráficas (por categoría y evolución 6 meses)
- **Auth requerida**: sí (admin)
- **Query Parameters**: ninguno
- **Response 200**:
  ```json
  {
    "by_category": [
      {
        "category": "Servicios",
        "amount": 8500.00
      },
      {
        "category": "Mantenimiento",
        "amount": 6200.00
      },
      {
        "category": "Seguridad",
        "amount": 3100.50
      },
      {
        "category": "Limpieza",
        "amount": 1200.00
      },
      {
        "category": "Administración",
        "amount": 900.25
      },
      {
        "category": "Otros",
        "amount": 500.00
      }
    ],
    "monthly_trend": [
      { "month": "2025-11", "total": 14300.00 },
      { "month": "2025-12", "total": 15800.50 },
      { "month": "2026-01", "total": 13200.75 },
      { "month": "2026-02", "total": 12900.00 },
      { "month": "2026-03", "total": 14100.25 },
      { "month": "2026-04", "total": 13500.00 }
    ]
  }
  ```
- **Response 401**: Token ausente o expirado
- **Response 403**: Usuario no tiene rol admin
- **Response 500**: Error interno del servidor

#### GET /expenses?month=YYYY-MM (existente, se conserva)
- **Descripción**: Lista gastos del mes especificado
- **Auth requerida**: sí (admin)
- **Query Parameters**:
  - `month` (opcional): formato YYYY-MM. Si no se proporciona, devuelve todos
- **Response 200**: 
  ```json
  {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "date": "2026-05-15",
        "provider": "Acme Corp",
        "category": "Mantenimiento",
        "concept": "Reparación de tubería",
        "amount": 850.50,
        "status": "ACTIVO",
        "created_at": "2026-05-15T10:30:00Z"
      }
    ],
    "total": 12500.50
  }
  ```

#### POST /expenses (existente, se conserva)
- **Descripción**: Crea un nuevo gasto
- **Auth requerida**: sí (admin)
- **Request Body**:
  ```json
  {
    "date": "2026-05-21",
    "provider": "Empresa de Servicios",
    "category": "Mantenimiento",
    "concept": "Arreglo de ascensor",
    "amount": 1250.75
  }
  ```
- **Response 201**: 
  ```json
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2026-05-21",
    "provider": "Empresa de Servicios",
    "category": "Mantenimiento",
    "concept": "Arreglo de ascensor",
    "amount": 1250.75,
    "status": "ACTIVO",
    "created_at": "2026-05-21T14:22:30Z"
  }
  ```
- **Response 400**: Campos requeridos faltantes o inválidos
- **Response 401**: Token ausente o expirado
- **Response 403**: Usuario no tiene rol admin

### Diseño Frontend

#### Componentes nuevos

| Componente | Archivo | Props principales | Descripción |
|------------|---------|------------------|-------------|
| `StatCardWithProgress` | `components/StatCardWithProgress/StatCardWithProgress.jsx` | `label, amount, budget, percentage, overBudgetAlert, icon, color` | Tarjeta de estadística con barra de progreso |
| `ExpenseForm` | `components/ExpenseForm/ExpenseForm.jsx` | `onSubmit, loading, error` | Formulario inline de registro de gastos |
| `RecentExpensesList` | `components/RecentExpensesList/RecentExpensesList.jsx` | `expenses, loading` | Panel con últimos 10 gastos |
| `ExpenseCategoryChart` | `components/ExpenseCategoryChart/ExpenseCategoryChart.jsx` | `data, loading` | Gráfica de barras por categoría (Recharts) |
| `ExpenseTrendChart` | `components/ExpenseTrendChart/ExpenseTrendChart.jsx` | `data, loading` | Gráfica de línea con evolución 6 meses (Recharts) |

#### Página rediseñada

| Página | Archivo | Ruta | Cambios |
|--------|---------|------|---------|
| `AdminExpensesPage` | `pages/admin/AdminExpensesPage.jsx` | `/admin/expenses` | **Completa renovación**: nuevo layout 2 columnas, 2 gráficas, formulario inline |

#### Estructura JSX de AdminExpensesPage

```jsx
export default function AdminExpensesPage() {
  // Estados
  const [currentMonth, setCurrentMonth] = useState(YYYY-MM-01)
  const [monthlyStats, setMonthlyStats] = useState(null)
  const [chartData, setChartData] = useState(null)
  const [recentExpenses, setRecentExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Effects: cargar datos al montar y cuando cambia mes
  useEffect(() => {
    fetchMonthlyStats()
    fetchChartData()
    fetchRecentExpenses()
  }, [currentMonth])

  // Handlers
  const handleCreateExpense = async (data) => {
    // POST /expenses
    // Actualizar recentExpenses
  }

  const handleGenerateReport = () => {
    // TODO: Implementar en futuro
    toast.info('Coming soon')
  }

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <div>
          <h1>Expense Registry</h1>
          <p className={styles.subtitle}>Track and manage your building expenses</p>
        </div>
        <button 
          className={styles.btnPrimary}
          onClick={handleGenerateReport}
        >
          Generate Report
        </button>
      </header>

      {/* ERROR BANNER */}
      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* STATS ROW: 2 tarjetas */}
      <div className={styles.statsRow}>
        <StatCardWithProgress
          label="Current Month Spend"
          amount={monthlyStats?.total_spend}
          budget={monthlyStats?.budget}
          percentage={monthlyStats?.percentage_used}
          icon="📊"
          color={getColorByPercentage(monthlyStats?.percentage_used)}
        />
        
        <StatCardWithProgress
          label="Maintenance & Repairs"
          amount={monthlyStats?.categories?.find(c => c.category === 'Mantenimiento')?.amount}
          budget={monthlyStats?.categories?.find(c => c.category === 'Mantenimiento')?.budget}
          percentage={monthlyStats?.categories?.find(c => c.category === 'Mantenimiento')?.percentage_used}
          overBudgetAlert={isMaintenanceOverBudget}
          icon="🔧"
          color={isMaintenanceOverBudget ? 'danger' : 'success'}
        />
      </div>

      {/* MAIN LAYOUT: 2 COLUMNAS */}
      <div className={styles.mainLayout}>
        
        {/* COLUMNA IZQUIERDA: FORMULARIO INLINE */}
        <div className={styles.leftColumn}>
          <h2>Record New Expense</h2>
          <ExpenseForm
            onSubmit={handleCreateExpense}
            loading={loading}
            error={error}
            categories={EXPENSE_CATEGORIES}
          />
        </div>

        {/* COLUMNA DERECHA: ÚLTIMOS GASTOS */}
        <div className={styles.rightColumn}>
          <h2>Recent Expenses</h2>
          <RecentExpensesList
            expenses={recentExpenses}
            loading={loading}
          />
        </div>
      </div>

      {/* GRÁFICAS */}
      <div className={styles.chartsRow}>
        <div className={styles.chartContainer}>
          <h3>Expenses by Category</h3>
          <ExpenseCategoryChart
            data={chartData?.by_category}
            loading={loading}
          />
        </div>

        <div className={styles.chartContainer}>
          <h3>Spending Trend (Last 6 Months)</h3>
          <ExpenseTrendChart
            data={chartData?.monthly_trend}
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}
```

#### Propiedades CSS Modules esperadas

```css
/* AdminExpensesPage.module.css */
.page { }
.header { }
.subtitle { }
.btnPrimary { }
.errorBanner { }
.statsRow { }
.mainLayout { }
.leftColumn { }
.rightColumn { }
.chartsRow { }
.chartContainer { }
```

#### Hooks necesarios

Se utilizarán los hooks existentes o se crearán nuevos según sea necesario:
- `useExpenses()` — ya existe, se reutiliza
- `useMonthlyStats()` — **NUEVO**: obtiene datos de `/expenses/stats/monthly`
- `useChartData()` — **NUEVO**: obtiene datos de `/expenses/stats/chart`

#### Dependencias de Frontend

- **Recharts**: ya debería estar en `package.json`, se usa para gráficas
  - `BarChart`, `LineChart`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `Bar`, `Line`

### Cambios en Backend

#### Archivo `backend/app/config/settings.py`

```python
# Agregar constantes de presupuesto
BUDGET_MONTHLY: Decimal = Decimal("15000.00")
BUDGET_MAINTENANCE: Decimal = Decimal("3500.00")
```

#### Archivo `backend/app/repositories/expense_repository.py`

**Nuevos métodos:**

```python
async def get_by_month_with_categories(self, month: str) -> dict:
    """
    Retorna gastos agrupados por categoría para un mes específico.
    Usado por endpoint de estadísticas.
    """
    # SELECT category, SUM(amount) as total 
    # FROM expenses WHERE TO_CHAR(date, 'YYYY-MM') = $1
    # GROUP BY category

async def get_monthly_total(self, month: str) -> Decimal:
    """
    Retorna suma total de gastos para un mes.
    """
    # SELECT SUM(amount) FROM expenses 
    # WHERE TO_CHAR(date, 'YYYY-MM') = $1

async def get_last_6_months_totals(self) -> list[dict]:
    """
    Retorna totales de gastos últimos 6 meses.
    Formato: [{"month": "YYYY-MM", "total": X.XX}, ...]
    """
    # SELECT TO_CHAR(date, 'YYYY-MM') as month, SUM(amount) as total
    # FROM expenses
    # WHERE date >= CURRENT_DATE - INTERVAL '6 months'
    # GROUP BY TO_CHAR(date, 'YYYY-MM')
    # ORDER BY month ASC

async def get_recent_expenses(self, limit: int = 10) -> list[dict]:
    """
    Retorna últimos N gastos ordenados por fecha descendente.
    """
    # SELECT * FROM expenses 
    # ORDER BY date DESC 
    # LIMIT $1
```

#### Archivo `backend/app/services/expense_service.py`

**Nuevos métodos:**

```python
async def get_monthly_stats(self, month: Optional[str] = None) -> dict:
    """
    Calcula estadísticas mensuales de presupuesto.
    Retorna: total_spend, budget, percentage_used, categories array
    """

async def get_chart_data(self) -> dict:
    """
    Prepara datos para gráficas: by_category y monthly_trend
    """

async def get_recent_expenses(self, limit: int = 10) -> list[dict]:
    """
    Retorna últimos gastos formateados para frontend
    """
```

#### Archivo `backend/app/routes/expenses.py`

**Nuevos endpoints:**

```python
@router.get("/expenses/stats/monthly")
async def get_monthly_stats(
    month: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """GET /expenses/stats/monthly"""
    service = ExpenseService(ExpenseRepository(db))
    return await service.get_monthly_stats(month)

@router.get("/expenses/stats/chart")
async def get_chart_data(
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """GET /expenses/stats/chart"""
    service = ExpenseService(ExpenseRepository(db))
    return await service.get_chart_data()
```

---

## 3. LISTA DE TAREAS

### Backend

- [ ] **Agregar constantes de presupuesto** en `backend/app/config/settings.py`
  - [ ] `BUDGET_MONTHLY = Decimal("15000.00")`
  - [ ] `BUDGET_MAINTENANCE = Decimal("3500.00")`

- [ ] **Implementar métodos en ExpenseRepository** (`backend/app/repositories/expense_repository.py`)
  - [ ] `get_by_month_with_categories(month: str) -> dict`
  - [ ] `get_monthly_total(month: str) -> Decimal`
  - [ ] `get_last_6_months_totals() -> list[dict]`
  - [ ] `get_recent_expenses(limit: int = 10) -> list[dict]`

- [ ] **Implementar métodos en ExpenseService** (`backend/app/services/expense_service.py`)
  - [ ] `get_monthly_stats(month: Optional[str] = None) -> dict`
  - [ ] `get_chart_data() -> dict`
  - [ ] `get_recent_expenses(limit: int = 10) -> list[dict]`

- [ ] **Crear nuevos endpoints** en `backend/app/routes/expenses.py`
  - [ ] `GET /expenses/stats/monthly` — con query param `month` opcional
  - [ ] `GET /expenses/stats/chart` — sin parámetros
  - [ ] Ambos requieren auth (admin)

- [ ] **Validar respuestas** de nuevos endpoints
  - [ ] Manejo de errores 400, 401, 403, 500
  - [ ] Estructura JSON coincide con especificación

- [ ] **Tests unitarios backend**
  - [ ] Test `test_monthly_stats_endpoint`
  - [ ] Test `test_chart_data_endpoint`
  - [ ] Test `test_monthly_stats_over_budget`

### Frontend

- [ ] **Crear componentes nuevos**
  - [ ] `StatCardWithProgress` en `src/components/StatCardWithProgress/StatCardWithProgress.jsx`
    - [ ] Props: label, amount, budget, percentage, overBudgetAlert, icon, color
    - [ ] Barra de progreso con colores (verde < 80%, amarillo 80-100%, rojo > 100%)
    - [ ] Mostrar alerta "Over Budget" si aplica
  
  - [ ] `ExpenseForm` en `src/components/ExpenseForm/ExpenseForm.jsx`
    - [ ] Campos: provider, category (select), date, amount, description (textarea)
    - [ ] Validación en tiempo real
    - [ ] Botón Submit deshabilitado si hay errores
    - [ ] **FUTURE**: Área drag & drop para archivos (por ahora omitir)
  
  - [ ] `RecentExpensesList` en `src/components/RecentExpensesList/RecentExpensesList.jsx`
    - [ ] Mostrar máximo 10 gastos
    - [ ] Ordenados por fecha descendente
    - [ ] Mostrar: concepto, proveedor, monto (negativo), fecha, ícono categoría
  
  - [ ] `ExpenseCategoryChart` en `src/components/ExpenseCategoryChart/ExpenseCategoryChart.jsx`
    - [ ] BarChart de Recharts
    - [ ] Mostrar categorías en eje X, montos en eje Y
    - [ ] Colores diferenciados por categoría
    - [ ] Responsive
  
  - [ ] `ExpenseTrendChart` en `src/components/ExpenseTrendChart/ExpenseTrendChart.jsx`
    - [ ] LineChart de Recharts
    - [ ] Mostrar últimos 6 meses en eje X, totales en eje Y
    - [ ] Responsive

- [ ] **Crear/actualizar hooks**
  - [ ] `useMonthlyStats(month?: string)` — obtiene `/expenses/stats/monthly`
  - [ ] `useChartData()` — obtiene `/expenses/stats/chart`
  - [ ] Ambos manejan loading y error

- [ ] **Rediseñar AdminExpensesPage** (`src/pages/admin/AdminExpensesPage.jsx`)
  - [ ] Header con título, subtítulo y botón "Generate Report"
  - [ ] Mostrar 2 tarjetas StatCardWithProgress
  - [ ] Layout 2 columnas (izquierda: formulario, derecha: recientes)
  - [ ] Integrar gráficas debajo
  - [ ] Banner de error
  - [ ] Manejo de loading states

- [ ] **Estilos** (`src/pages/admin/AdminExpensesPage.module.css`)
  - [ ] Estilos para header, stats row, main layout (2 cols), charts row
  - [ ] Responsive (mobile: columna única, desktop: 2+ columnas)
  - [ ] Colores coherentes con diseño existente

- [ ] **Tests unitarios frontend**
  - [ ] Test `AdminExpensesPage` renders correctly
  - [ ] Test `StatCardWithProgress` muestra barra de progreso
  - [ ] Test `StatCardWithProgress` muestra alerta cuando over budget
  - [ ] Test `ExpenseForm` valida campos requeridos
  - [ ] Test `ExpenseForm` submit llama a onSubmit

### QA / Integración

- [ ] **Prueba end-to-end**
  - [ ] Admin carga página → ve estadísticas correctas
  - [ ] Admin registra gasto → aparece en "Recent Expenses"
  - [ ] Gráficas cargan y se muestran correctamente
  - [ ] Páginas son responsivas en mobile/tablet/desktop

- [ ] **Casos de error**
  - [ ] API inaccesible → mostrar banner de error
  - [ ] Usuario no autenticado → redirigir a login
  - [ ] Presupuesto se excede → mostrar alerta "Over Budget"

- [ ] **Performance**
  - [ ] Página carga en < 2 segundos (LCP)
  - [ ] Gráficas no bloquean interacción (lazy load si es necesario)

### Documentación

- [ ] **README.md** — actualizar sección "Expense Module"
  - [ ] Describir nuevo layout y funcionalidades
  - [ ] Listar nuevos endpoints
  - [ ] Presupuestos configurables en settings

- [ ] **API Docs** — documentar nuevos endpoints
  - [ ] `GET /expenses/stats/monthly`
  - [ ] `GET /expenses/stats/chart`

---

## Notas Adicionales

### Futuras Mejoras (No incluir en MVP)

1. **Drag & drop de archivos**: Implementar upload de recibos/facturas
2. **Exportar a PDF/Excel**: Implementar generación de reportes
3. **Presupuestos por categoría dinámicos**: Crear tabla de presupuestos editable
4. **Aprobación de gastos**: Workflow de aprobación multi-usuario
5. **Filtros avanzados**: Por rango de fechas, proveedor, categoría, monto

### Stack Confirmado

- **Backend**: FastAPI, Python, PostgreSQL (asyncpg)
- **Frontend**: React 18, Vite, JSX (sin TypeScript), CSS Modules, Recharts
- **Auth**: Firebase + JWT (existente)
- **Gráficas**: Recharts

### Diccionario de Dominio

- **Gasto (Expense)**: Registro de egreso asociado a una categoría, proveedor y fecha
- **Presupuesto (Budget)**: Límite de gasto configurado (actualmente constantes en settings)
- **Categoría**: Clasificación de gastos (Servicios, Mantenimiento, Seguridad, Limpieza, Administración, Otros)
- **Porcentaje Utilizado**: (Gasto Total / Presupuesto) * 100

---

## Activación del Agente

Para regenerar o actualizar esta especificación, usar en Copilot Chat:

```
/generate-spec
```

Estado: **DRAFT** → Cambiar a **APPROVED** cuando sea aprobado por Product Owner.
