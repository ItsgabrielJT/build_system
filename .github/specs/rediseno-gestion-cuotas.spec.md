---
id: SPEC-001
status: DRAFT
feature: rediseno-gestion-cuotas
created: 2026-05-21
updated: 2026-05-21
author: spec-generator
version: "1.0"
related-specs: []
---

# Spec: Rediseño Gestión de Cuotas + API de Estadísticas

> **Estado:** `DRAFT` → aprobar con `status: APPROVED` antes de iniciar implementación.  
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED → DEPRECATED

---

## 1. REQUERIMIENTOS

### Descripción

Rediseño completo de la página `AdminFeesPage` para proporcionar un dashboard de estadísticas centralizado sobre emisión y recaudación de cuotas por períodos. Se agregan dos nuevos endpoints de estadísticas en el backend que alimentan las métricas visuales de la interfaz. La funcionalidad existente de "carga masiva" y "crear cuota" se mantiene, pero se integra en un contexto de análisis más completo.

### Requerimiento de Negocio

El administrador requiere visualizar de forma centralizada:
1. Métricas del período actual (total emitido, recaudado, pendiente)
2. Indicadores de desempeño con tendencias y progreso
3. Historial de períodos con estado, morosidad y acciones rápidas
4. Capacidad de filtrar, exportar y emitir nuevas cuotas desde un punto único

### Historias de Usuario

#### HU-01: Visualizar estadísticas del período actual

```
Como:        Administrador
Quiero:      ver métricas resumidas del período actual en 3 cards principales
Para:        monitorear rápidamente la salud financiera de la gestión de cuotas

Prioridad:   Alta
Estimación:  M
Dependencias: Ninguna
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-01

**Happy Path**
```gherkin
CRITERIO-1.1: Cargar estadísticas del período actual
  Dado que:  soy un administrador autenticado
  Cuando:    accedo a la página de Gestión de Cuotas
  Entonces:  veo 3 cards con: total emitido, total recaudado y pendiente de cobro
```

```gherkin
CRITERIO-1.2: Mostrar tendencia de emisión
  Dado que:  hay datos de cuotas del período actual y anterior
  Cuando:    se cargan las estadísticas
  Entonces:  en el card "TOTAL EMITIDO" aparece un badge con tendencia % (ej: +4.2%)
```

```gherkin
CRITERIO-1.3: Mostrar progreso de recaudación
  Dado que:  hay cuotas emitidas y pagos confirmados en el período
  Cuando:    se cargan las estadísticas
  Entonces:  el card "TOTAL RECAUDADO" muestra una barra de progreso + porcentaje alcanzado
```

```gherkin
CRITERIO-1.4: Indicar deuda vencida
  Dado que:  hay cuotas no pagadas con fecha de vencimiento pasada
  Cuando:    se cargan las estadísticas
  Entonces:  el card "PENDIENTE DE COBRO" muestra un badge rojo con cantidad de unidades con deuda vencida
```

**Error Path**
```gherkin
CRITERIO-1.5: Manejo de error en carga de estadísticas
  Dado que:  la API devuelve un error 500 al obtener estadísticas
  Cuando:    se intenta cargar la página
  Entonces:  se muestra un mensaje de error y un botón para reintentar
```

**Edge Case**
```gherkin
CRITERIO-1.6: Período sin cuotas emitidas
  Dado que:  el período actual no tiene cuotas emitidas
  Cuando:    se cargan las estadísticas
  Entonces:  los cards muestran 0 y las tendencias/barras se desactivan (greyed out)
```

---

#### HU-02: Consultar historial de períodos con resumen

```
Como:        Administrador
Quiero:      ver una tabla paginada con resumen de todos los períodos históricos
Para:        analizar tendencias y tomar decisiones sobre períodos cerrados

Prioridad:   Alta
Estimación:  M
Dependencias: HU-01
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-02

**Happy Path**
```gherkin
CRITERIO-2.1: Listar períodos con paginación
  Dado que:  existen múltiples períodos en el sistema
  Cuando:    accedo a la sección "Historial de Períodos"
  Entonces:  veo una tabla paginada (10 registros por página) con: PERÍODO, ESTADO, EMITIDO, RECAUDADO, MOROSIDAD
```

```gherkin
CRITERIO-2.2: Mostrar estado del período
  Dado que:  el período tiene cuotas emitidas
  Cuando:    se renderiza la tabla
  Entonces:  veo un badge con el estado: ABIERTO (azul), VENCIDO (naranja) o CERRADO (gris)
```

```gherkin
CRITERIO-2.3: Calcular y mostrar morosidad
  Dado que:  el período tiene cuotas emitidas y pagos parciales
  Cuando:    se carga el resumen
  Entonces:  veo un % de morosidad + barra visual de progreso (roja para deuda, verde para pago)
```

**Error Path**
```gherkin
CRITERIO-2.4: Manejo de error en carga de períodos
  Dado que:  la API devuelve un error 400 (período inválido)
  Cuando:    se intenta cargar la tabla
  Entonces:  se muestra un mensaje de error contextualizado
```

---

#### HU-03: Acciones rápidas y filtrado

```
Como:        Administrador
Quiero:      filtrar períodos por año, exportar todo y emitir nuevas cuotas desde una ubicación central
Para:        optimizar mi flujo de trabajo de gestión de cuotas

Prioridad:   Media
Estimación:  S
Dependencias: HU-02
Capa:        Frontend (parcialmente Backend para exportación)
```

#### Criterios de Aceptación — HU-03

**Happy Path**
```gherkin
CRITERIO-3.1: Filtrar períodos por año
  Dado que:  la tabla muestra todos los períodos
  Cuando:    selecciono un año en el filtro "Filtrar Año"
  Entonces:  la tabla se actualiza mostrando solo los períodos de ese año
```

```gherkin
CRITERIO-3.2: Emitir cuota próximo mes
  Dado que:  estoy en la página de Gestión de Cuotas
  Cuando:    hago clic en "+ Emitir Cuota Próximo Mes"
  Entonces:  se abre el modal de carga masiva pre-cargado con el próximo mes
```

```gherkin
CRITERIO-3.3: Exportar todos los períodos
  Dado que:  la tabla está cargada
  Cuando:    hago clic en "Exportar Todo"
  Entonces:  se descarga un archivo CSV/Excel con toda la información de períodos
```

---

### Reglas de Negocio

1. **Período actual**: Se determina automáticamente como el mes en formato `YYYY-MM` de la fecha actual del servidor.
2. **Tendencia**: Se calcula como `((emitido_mes_actual - emitido_mes_anterior) / emitido_mes_anterior) * 100`. Si el mes anterior no existe, mostrar "N/A".
3. **Morosidad**: Porcentaje de deuda pendiente = `((emitido - recaudado) / emitido) * 100`.
4. **Unidades con deuda vencida**: Contar apartamentos con `period < fecha_hoy` y `saldo > 0`.
5. **Estado del período**: 
   - ABIERTO: período actual o futuro, o período pasado con pagos pendientes
   - VENCIDO: período pasado con total emitido pero saldo pendiente
   - CERRADO: período pasado con 100% recaudado
6. **Autorización**: Solo administrador (`require_admin`) puede acceder.
7. **Recaudación confirmada**: Solo contar pagos con `status = 'CONFIRMED'` o equivalente.

---

## 2. DISEÑO

### Modelos de Datos

#### Entidades afectadas

| Entidad | Almacén | Cambios | Descripción |
|---------|---------|---------|-------------|
| `apartment_fees` | tabla `apartment_fees` | ninguno | Existente, sin cambios estructurales |
| `payments` | tabla `payments` | ninguno | Existente, se consulta para recaudación |
| `apartments` | tabla `apartments` | ninguno | Existente, se consulta para deuda vencida |

#### Nuevos campos/cálculos (lado backend/servicio)

Estos no son campos de BD, sino cálculos derivados para los endpoints de estadísticas:

| Campo | Tipo | Fuente | Descripción |
|-------|------|--------|-------------|
| `total_emitido` | decimal | SUM(`apartment_fees.amount`) para el período | Total emitido en el período |
| `total_recaudado` | decimal | SUM(`payments.amount`) donde `status='CONFIRMED'` para el período | Total pagado confirmado |
| `pendiente_cobro` | decimal | `total_emitido - total_recaudado` | Diferencia |
| `porcentaje_recaudado` | float | `(total_recaudado / total_emitido) * 100` | % de meta alcanzada |
| `unidades_deuda_vencida` | int | COUNT(DISTINCT `apartment_id`) donde `period < now()` y `saldo > 0` | Apartamentos con deuda vencida |
| `tendencia_emitido` | float | `((emitido_actual - emitido_anterior) / emitido_anterior) * 100` | % de cambio mensual |
| `morosidad_pct` | float | `(pendiente_cobro / total_emitido) * 100` | % de morosidad |
| `estado` | string enum | lógica condicional | ABIERTO / VENCIDO / CERRADO |

#### Índices / Constraints

| Índice | Tabla | Campos | Justificación |
|--------|-------|--------|---------------|
| `idx_apartment_fees_period` | `apartment_fees` | `(period)` | Búsqueda frecuente por período en stats |
| `idx_payments_period_status` | `payments` | `(period, status)` | Filtrado rápido de pagos confirmados |

---

### API Endpoints

#### GET /api/v1/apartment-fees/stats

- **Descripción**: Obtiene estadísticas del período especificado (o del período actual si no se proporciona)
- **Auth requerida**: Sí (require_admin)
- **Query Parameters**:
  ```
  period: string (YYYY-MM) — opcional, default = mes actual
  ```
- **Request Body**: N/A
- **Response 200**:
  ```json
  {
    "period": "2026-05",
    "total_emitido": 1240500.00,
    "total_recaudado": 892300.00,
    "pendiente_cobro": 348200.00,
    "porcentaje_recaudado": 72.0,
    "unidades_deuda_vencida": 12,
    "tendencia_emitido": 4.2
  }
  ```
- **Response 400**: período con formato inválido
- **Response 401**: token ausente o expirado
- **Response 403**: usuario no es administrador

#### GET /api/v1/apartment-fees/periods-summary

- **Descripción**: Lista paginada de períodos con resumen (últimos 24 meses por defecto)
- **Auth requerida**: Sí (require_admin)
- **Query Parameters**:
  ```
  page: int = 1
  page_size: int = 10
  year: int (opcional) — filtro por año YYYY
  ```
- **Request Body**: N/A
- **Response 200**:
  ```json
  {
    "data": [
      {
        "period": "2026-05",
        "label": "Mayo 2026",
        "vencimiento": "2026-05-10",
        "estado": "ABIERTO",
        "total_emitido": 1240500.00,
        "total_recaudado": 892300.00,
        "morosidad_pct": 28.0
      }
    ],
    "total": 24,
    "page": 1,
    "page_size": 10
  }
  ```
- **Response 400**: parámetros inválidos (ej. `page_size > 100`)
- **Response 401**: token ausente o expirado
- **Response 403**: usuario no es administrador

#### Endpoints existentes (sin cambios de firma)

- `GET /api/v1/apartment-fees?period=YYYY-MM` — lista cuotas del período (existente)
- `POST /api/v1/apartment-fees` — crear cuota individual (existente)
- `POST /api/v1/apartment-fees/bulk` — carga masiva (existente)

---

### Schemas Pydantic (Backend)

#### Nuevos Response Schemas

```python
class ApartmentFeeStatsResponse(BaseModel):
    """Respuesta del endpoint /apartment-fees/stats"""
    period: str                      # YYYY-MM
    total_emitido: Decimal
    total_recaudado: Decimal
    pendiente_cobro: Decimal
    porcentaje_recaudado: float      # 0-100
    unidades_deuda_vencida: int
    tendencia_emitido: float         # % o None si no hay mes anterior


class PeriodSummaryItem(BaseModel):
    """Item individual en la lista de períodos"""
    period: str                      # YYYY-MM
    label: str                       # "Mayo 2026" (i18n ready)
    vencimiento: Optional[str]       # YYYY-MM-DD (fecha de vencimiento del período)
    estado: str                      # "ABIERTO" | "VENCIDO" | "CERRADO"
    total_emitido: Decimal
    total_recaudado: Decimal
    morosidad_pct: float             # 0-100


class PeriodsSummaryResponse(BaseModel):
    """Respuesta paginada del endpoint /periods-summary"""
    data: List[PeriodSummaryItem]
    total: int                       # total de períodos en el sistema
    page: int
    page_size: int
```

---

### Diseño Frontend

#### Componentes nuevos

| Componente | Archivo | Props principales | Descripción |
|------------|---------|------------------|-------------|
| `StatsCard` | `components/StatsCard/StatsCard.jsx` | `title`, `value`, `badge?`, `progressBar?`, `badgeColor?` | Card reutilizable de métrica |
| `PeriodStatusBadge` | `components/PeriodStatusBadge/PeriodStatusBadge.jsx` | `status` ("ABIERTO"\|"VENCIDO"\|"CERRADO") | Badge de estado |
| `PeriodsHistoryTable` | `components/PeriodsHistoryTable/PeriodsHistoryTable.jsx` | `data`, `loading`, `onFilter`, `onExport`, `onViewDetails` | Tabla de histórico |
| `ProgressBar` | `components/ProgressBar/ProgressBar.jsx` | `percentage`, `color?` | Barra de progreso visual |
| `YearFilter` | `components/YearFilter/YearFilter.jsx` | `onYearChange`, `currentYear?` | Selector de año |

#### Página rediseñada

| Página | Archivo | Ruta | Protegida | Cambios |
|--------|---------|------|-----------|---------|
| `AdminFeesPage` | `pages/admin/AdminFeesPage.jsx` | `/admin/fees` | Sí | Rediseño completo con stats + tabla |

#### Layout esperado de AdminFeesPage

```
┌─────────────────────────────────────────────────────────────┐
│ GESTIÓN DE CUOTAS                [+ Emitir Cuota Próximo Mes]│
│ Control centralizado de emisión y recaudación por períodos. │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ TOTAL        │  │ TOTAL        │  │ PENDIENTE    │
│ EMITIDO (MES)│  │ RECAUDADO    │  │ DE COBRO     │
│ $1,240,500   │  │ $892,300     │  │ $348,200     │
│ +4.2% vs mes │  │ ██████░░ 72% │  │ 12 unidades  │
│ anterior     │  │              │  │ con deuda    │
└──────────────┘  └──────────────┘  └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│ HISTORIAL DE PERÍODOS                                       │
│ [Filtrar Año ▼] [Exportar Todo]                            │
├─────────────┬────────┬────────────┬────────────┬──────────────┤
│ PERÍODO     │ ESTADO │ EMITIDO    │ RECAUDADO  │ MOROSIDAD    │
├─────────────┼────────┼────────────┼────────────┼──────────────┤
│ Mayo 2026   │ ABIERTO│ $1,240,500 │ $892,300   │ 28% ██░░░░   │
│ Abril 2026  │ CERRADO│ $1,200,000 │ $1,200,000 │  0% ████████ │
│ Marzo 2026  │ VENCIDO│ $1,180,000 │ $950,000   │ 19% ███░░░░░ │
│                                                               │
│ ◄ 1 / 3 ►                                                    │
└─────────────────────────────────────────────────────────────┘
```

#### Hooks y State

| Hook | Archivo | Retorna | Descripción |
|------|---------|---------|-------------|
| `useApartmentFeeStats` | `hooks/useApartmentFeeStats.js` | `{ stats, loading, error, fetchStats }` | Estadísticas del período |
| `usePeriodsSummary` | `hooks/usePeriodsSummary.js` | `{ periods, total, page, loading, error, fetchPeriods, setPage, setYear }` | Histórico paginado |

#### Services (llamadas API)

| Función | Archivo | Endpoint |
|---------|---------|---------|
| `getApartmentFeeStats(period, token)` | `services/apartmentFeeService.js` | `GET /api/v1/apartment-fees/stats?period=YYYY-MM` |
| `getPeriodsSummary(page, pageSize, year, token)` | `services/apartmentFeeService.js` | `GET /api/v1/apartment-fees/periods-summary?page=X&page_size=Y&year=Z` |
| `exportPeriodsSummary(token)` | `services/apartmentFeeService.js` | `GET /api/v1/apartment-fees/periods-summary` + trigger download CSV |

#### CSS Modules

| Módulo | Archivo | Secciones principales |
|--------|---------|---------------------|
| `AdminFeesPage.module.css` | `pages/admin/AdminFeesPage.module.css` | `.header`, `.statsContainer`, `.statCard`, `.tableWrapper`, `.pagination`, `.filters` |
| `StatsCard.module.css` | `components/StatsCard/StatsCard.module.css` | `.card`, `.title`, `.value`, `.badge`, `.progressBar` |
| `ProgressBar.module.css` | `components/ProgressBar/ProgressBar.module.css` | `.barContainer`, `.barFill` |

---

### Arquitectura y Dependencias

#### Backend

- **Nuevos métodos en `ApartmentFeeRepository`**:
  - `async get_stats(period: str) -> dict` — calcula métricas del período
  - `async get_periods_summary(page: int = 1, page_size: int = 10, year: Optional[int] = None) -> dict` — lista períodos paginados
  
- **Nuevos métodos en `ApartmentFeeService`**:
  - `async get_stats(period: str) -> dict` — delega a repository
  - `async get_periods_summary(page: int, page_size: int, year: Optional[int]) -> dict` — delega a repository

- **Nuevos endpoints en `routes/apartment_fees.py`**:
  - `GET /apartment-fees/stats` 
  - `GET /apartment-fees/periods-summary`

- **Nuevos schemas en `models/schemas.py`**:
  - `ApartmentFeeStatsResponse`
  - `PeriodSummaryItem`
  - `PeriodsSummaryResponse`

- **Paquetes nuevos**: Ninguno (asyncpg ya está disponible)

#### Frontend

- **Nuevos componentes**: `StatsCard`, `PeriodStatusBadge`, `PeriodsHistoryTable`, `ProgressBar`, `YearFilter`
- **Nuevos hooks**: `useApartmentFeeStats`, `usePeriodsSummary`
- **Nuevos servicios**: Métodos en `apartmentFeeService.js`
- **Paquetes nuevos**: Ninguno (Axios ya está disponible)

#### Integraciones externas

- Ninguna nueva. El backend consulta la BD existente (PostgreSQL).

---

### Notas de Implementación

1. **Cálculo de fecha de vencimiento del período**: Asumir que cada período vence el día 10 del mes siguiente (ej: período "2026-05" vence "2026-06-10"). Esto es configurable en el servicio.

2. **Estado del período**: Lógica condicional en el servicio:
   - Si `period >= YYYY-MM actual`: ABIERTO
   - Si `period < YYYY-MM actual` y `morosidad_pct == 0`: CERRADO
   - Si `period < YYYY-MM actual` y `morosidad_pct > 0`: VENCIDO

3. **Tendencia**: Si el mes anterior no existe en la BD, retornar `null` en lugar de fallar. Frontend mostrará "N/A" o un guión.

4. **Exportación CSV**: Usar la misma data de `get_periods_summary()`. Frontend puede usar librerías como `papaparse` o generar manualmente el CSV.

5. **Paginación**: El default es 10 registros. Backend debe validar que `page_size <= 100`.

6. **Deuda vencida**: Considerar que la deuda está vencida si `period` es anterior al período actual y hay saldo pendiente.

7. **Validación de período**: Todos los endpoints aceptan parámetro `period` en formato `YYYY-MM`. Debe validarse antes de procesar.

8. **Token en header**: Siempre `Authorization: Bearer <token>`.

9. **Mantenimiento de existentes**: Los endpoints `POST /apartment-fees` y `POST /apartment-fees/bulk` siguen sin cambios. El modal de carga masiva en el frontend se reutiliza, solo que se pre-carga con el próximo mes cuando se hace clic en "+ Emitir Cuota Próximo Mes".

---

## 3. LISTA DE TAREAS

> Checklist accionable para todos los agentes. Marcar cada ítem (`[x]`) al completarlo.  
> El Orchestrator monitorea este checklist para determinar el progreso.

### Backend

#### Implementación de Repositorio
- [ ] Agregar método `get_stats(period: str)` a `ApartmentFeeRepository`
  - [ ] Calcular `total_emitido` (SUM de cuotas del período)
  - [ ] Calcular `total_recaudado` (SUM de pagos confirmados del período)
  - [ ] Calcular `pendiente_cobro` (diferencia)
  - [ ] Calcular `porcentaje_recaudado` (%)
  - [ ] Calcular `unidades_deuda_vencida` (COUNT apartamentos con deuda vencida)
  - [ ] Calcular `tendencia_emitido` (% vs mes anterior)
  
- [ ] Agregar método `get_periods_summary(page, page_size, year)` a `ApartmentFeeRepository`
  - [ ] Listar todos los períodos únicos (máximo últimos 24)
  - [ ] Implementar paginación (OFFSET/LIMIT)
  - [ ] Implementar filtro por año (opcional)
  - [ ] Calcular `estado` para cada período
  - [ ] Calcular `morosidad_pct` para cada período
  - [ ] Retornar respuesta con `data`, `total`, `page`, `page_size`

#### Implementación de Servicio
- [ ] Agregar método `get_stats(period: str)` a `ApartmentFeeService`
  - [ ] Validar formato de período (YYYY-MM)
  - [ ] Si período no proporcionado, usar período actual
  - [ ] Delegar cálculos a repository
  - [ ] Retornar `ApartmentFeeStatsResponse`

- [ ] Agregar método `get_periods_summary(page, page_size, year)` a `ApartmentFeeService`
  - [ ] Validar parámetros (page >= 1, page_size <= 100)
  - [ ] Delegar a repository
  - [ ] Retornar `PeriodsSummaryResponse`

#### Implementación de Rutas
- [ ] Crear endpoint `GET /apartment-fees/stats` en `routes/apartment_fees.py`
  - [ ] Aplicar `@require_admin`
  - [ ] Aceptar query param `period` (opcional)
  - [ ] Instanciar dependencies (db, service)
  - [ ] Retornar `ApartmentFeeStatsResponse` (201 si exitoso)

- [ ] Crear endpoint `GET /apartment-fees/periods-summary` en `routes/apartment_fees.py`
  - [ ] Aplicar `@require_admin`
  - [ ] Aceptar query params: `page`, `page_size`, `year`
  - [ ] Instanciar dependencies (db, service)
  - [ ] Retornar `PeriodsSummaryResponse` (200 si exitoso)

#### Schemas
- [ ] Agregar `ApartmentFeeStatsResponse` a `models/schemas.py`
- [ ] Agregar `PeriodSummaryItem` a `models/schemas.py`
- [ ] Agregar `PeriodsSummaryResponse` a `models/schemas.py`
- [ ] Agregar validadores si es necesario (ej. `@field_validator("period")`)

#### Tests Backend
- [ ] `test_apartment_fee_service_get_stats_success` — obtener stats del período actual
- [ ] `test_apartment_fee_service_get_stats_no_fees` — período sin cuotas (retorna 0)
- [ ] `test_apartment_fee_service_get_stats_invalid_period` — período con formato inválido (400)
- [ ] `test_apartment_fee_repo_get_periods_summary_first_page` — listar períodos paginados
- [ ] `test_apartment_fee_repo_get_periods_summary_filter_year` — filtro por año
- [ ] `test_apartment_fee_repo_get_periods_summary_page_size_validation` — page_size > 100 (400)
- [ ] `test_apartment_fees_stats_endpoint_returns_200` — endpoint GET /stats
- [ ] `test_apartment_fees_stats_endpoint_requires_auth` — sin token (401)
- [ ] `test_apartment_fees_stats_endpoint_requires_admin` — usuario sin permisos (403)
- [ ] `test_apartment_fees_periods_summary_endpoint_returns_200` — endpoint GET /periods-summary
- [ ] `test_apartment_fees_periods_summary_endpoint_pagination` — parámetros de paginación

### Frontend

#### Componentes nuevos
- [ ] Crear `components/StatsCard/StatsCard.jsx`
  - [ ] Propiedades: `title`, `value`, `badge` (opcional), `progressBar` (opcional), `badgeColor`
  - [ ] Estilos en `StatsCard.module.css`
  - [ ] Renderizar badge si existe (con color condicional)
  - [ ] Renderizar barra de progreso si existe

- [ ] Crear `components/PeriodStatusBadge/PeriodStatusBadge.jsx`
  - [ ] Propiedades: `status` (ABIERTO | VENCIDO | CERRADO)
  - [ ] Estilos en `PeriodStatusBadge.module.css`
  - [ ] Colores: ABIERTO=azul, VENCIDO=naranja, CERRADO=gris

- [ ] Crear `components/ProgressBar/ProgressBar.jsx`
  - [ ] Propiedades: `percentage` (0-100), `color` (opcional, default=green)
  - [ ] Estilos en `ProgressBar.module.css`
  - [ ] Mostrar etiqueta con % dentro o al lado

- [ ] Crear `components/PeriodsHistoryTable/PeriodsHistoryTable.jsx`
  - [ ] Propiedades: `data`, `loading`, `onFilter`, `onExport`, `onViewDetails`, `pagination`
  - [ ] Columnas: PERÍODO, ESTADO, EMITIDO, RECAUDADO, MOROSIDAD
  - [ ] Renderizar `PeriodStatusBadge` en columna ESTADO
  - [ ] Renderizar `ProgressBar` en columna MOROSIDAD
  - [ ] Botones de acción: ojo (ver detalle), gráfico (visualización)
  - [ ] Estilos en `PeriodsHistoryTable.module.css`

- [ ] Crear `components/YearFilter/YearFilter.jsx`
  - [ ] Propiedades: `onYearChange`, `currentYear` (opcional)
  - [ ] Dropdown con años (últimos 5 años + próximo año)
  - [ ] Estilos en `YearFilter.module.css`

#### Hooks
- [ ] Crear `hooks/useApartmentFeeStats.js`
  - [ ] Estados: `stats`, `loading`, `error`
  - [ ] Función: `fetchStats(period?: string)` — default = período actual
  - [ ] Usar `useAuth()` para obtener token
  - [ ] Usar `apartmentFeeService.getApartmentFeeStats()`

- [ ] Crear `hooks/usePeriodsSummary.js`
  - [ ] Estados: `periods`, `total`, `page`, `pageSize`, `year`, `loading`, `error`
  - [ ] Funciones: `fetchPeriods(page, pageSize, year?)`, `setPage(n)`, `setYear(y)`
  - [ ] Usar `useAuth()` para obtener token
  - [ ] Usar `apartmentFeeService.getPeriodsSummary()`

#### Services
- [ ] Actualizar `services/apartmentFeeService.js`
  - [ ] Agregar `getApartmentFeeStats(period?, token)` — GET /apartment-fees/stats
  - [ ] Agregar `getPeriodsSummary(page, pageSize, year?, token)` — GET /apartment-fees/periods-summary
  - [ ] Agregar `exportPeriodsSummary(token)` — retorna CSV data
  - [ ] Mantener servicios existentes: `createFee`, `bulkUploadFees`, `getFeesByPeriod`

#### Página AdminFeesPage rediseñada
- [ ] Rediseñar `pages/admin/AdminFeesPage.jsx`
  - [ ] Header: Título "Gestión de Cuotas" + subtítulo + botón "+ Emitir Cuota Próximo Mes"
  - [ ] Sección de 3 stats cards (usar `StatsCard`)
  - [ ] Usar hook `useApartmentFeeStats` para cargar estadísticas del período actual
  - [ ] Sección "Historial de Períodos" con tabla (usar `PeriodsHistoryTable`)
  - [ ] Usar hook `usePeriodsSummary` para cargar y paginar
  - [ ] Botones de filtro por año (usar `YearFilter`) y exportar
  - [ ] Mantener modal de carga masiva (reutilizar código existente)
  - [ ] Pre-cargar próximo mes en modal cuando se hace clic en CTA

- [ ] Crear estilos en `pages/admin/AdminFeesPage.module.css`
  - [ ] Layout grid para las 3 stats cards
  - [ ] Estilos para header, tabla, paginación
  - [ ] Media queries para responsividad (mobile, tablet, desktop)

#### Tests Frontend
- [ ] `test_useApartmentFeeStats_success` — hook carga estadísticas correctamente
- [ ] `test_useApartmentFeeStats_error` — hook maneja error de API
- [ ] `test_usePeriodsSummary_success` — hook carga períodos paginados
- [ ] `test_usePeriodsSummary_filter_year` — filtro por año actualiza data
- [ ] `test_StatsCard_renders_correctly` — componente renderiza título, valor, badge
- [ ] `test_ProgressBar_shows_percentage` — barra muestra % correcto
- [ ] `test_PeriodStatusBadge_color_by_status` — badge cambia color según estado
- [ ] `test_PeriodsHistoryTable_renders_data` — tabla renderiza períodos
- [ ] `test_PeriodsHistoryTable_pagination_buttons` — botones de paginación funcionan
- [ ] `test_AdminFeesPage_loads_stats_on_mount` — página carga stats al cargar
- [ ] `test_AdminFeesPage_open_bulk_modal` — botón CTA abre modal con próximo mes
- [ ] `test_AdminFeesPage_export_download` — botón exportar descarga CSV

### QA / Integración

#### Test cases Gherkin (entrada al QA Agent)
- [ ] Spec de casos Gherkin en `docs/output/qa/rediseno-gestion-cuotas.gherkin.feature`
- [ ] Datos de prueba y datasets en `docs/output/qa/test-data.json`

#### Risk Assessment
- [ ] Spec de riesgos en `docs/output/qa/risk-assessment.md`
- [ ] Clasificación: Alto (obligatorio), Medio (recomendado), Bajo (opcional)

#### Performance Analysis
- [ ] Plan de pruebas de performance en `docs/output/qa/performance-plan.md`
- [ ] Define SLAs para endpoints de stats (ej. < 500ms)

---

## Cambios Resumidos

### Backend
- 2 nuevos endpoints (`/stats`, `/periods-summary`)
- 2 nuevos métodos en repository
- 2 nuevos métodos en service
- 3 nuevos response schemas

### Frontend
- 1 página rediseñada (`AdminFeesPage`)
- 5 nuevos componentes
- 2 nuevos hooks
- 3 nuevas funciones en servicio
- 1 nuevo módulo CSS para página
- 5 nuevos módulos CSS para componentes

### Datos
- Sin cambios en estructura de tablas (solo nuevas queries)
- 2 nuevos índices recomendados

---

## Estado Actual

**Status**: `DRAFT`

Esta spec está lista para ser revisada y aprobada. Una vez aprobada (status: APPROVED), el Orchestrator coordina la implementación paralela en Backend, Frontend y Tests.

