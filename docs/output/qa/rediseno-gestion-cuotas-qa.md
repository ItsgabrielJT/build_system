# Estrategia QA — Rediseño Gestión de Cuotas

**Spec de referencia:** `.github/specs/rediseno-gestion-cuotas.spec.md`
**Feature:** `rediseno-gestion-cuotas`
**Versión spec:** 1.0
**Fecha análisis:** 2026-05-21
**Estado implementación:** 12 tests backend + 21 tests frontend en verde

---

## 1. Matriz de Riesgos (Regla ASD)

### Criterios de clasificación

| Nivel | Criterio |
|-------|---------|
| **ALTO** | Flujo crítico de negocio, dato financiero, seguridad o autenticación |
| **MEDIO** | Impacta UX directamente o puede causar datos incorrectos sin consecuencia financiera inmediata |
| **BAJO** | Comportamiento visual, mensajes informativos o funcionalidad auxiliar |

---

### Tabla de riesgos

| ID | Área | Descripción del Riesgo | Nivel | Justificación |
|----|------|------------------------|-------|---------------|
| R-01 | Backend / Cálculo | `total_emitido` o `total_recaudado` calculados incorrectamente | **ALTO** | Impacto financiero directo; valores erróneos mostrados al administrador |
| R-02 | Backend / Cálculo | `morosidad_pct` calculada sobre base 0 → división por cero | **ALTO** | Rompe el endpoint en períodos sin cuotas emitidas |
| R-03 | Backend / Cálculo | `tendencia_emitido` retorna valor cuando no hay período anterior (debería ser null/N/A) | **ALTO** | Información financiera engañosa para toma de decisiones |
| R-04 | Backend / Seguridad | Endpoint `/stats` y `/periods-summary` accesibles por rol PROPIETARIO | **ALTO** | Fuga de datos financieros a rol no autorizado (OWASP A01) |
| R-05 | Backend / Seguridad | Endpoint accesible sin token (sin `Authorization` header) | **ALTO** | Acceso no autenticado a datos financieros (OWASP A07) |
| R-06 | Backend / Estado | `estado` del período calculado incorrectamente (ABIERTO/VENCIDO/CERRADO) | **ALTO** | Confusión operativa en gestión de cobranza |
| R-07 | Backend / Paginación | `page_size > 100` aceptado → posible DoS por carga masiva de registros | **MEDIO** | Degradación de performance con datasets grandes |
| R-08 | Backend / Validación | Período con formato inválido (ej. `"2026-13"`, `"abc"`) no rechazado con 422 | **MEDIO** | Consultas con datos inválidos llegan a la BD |
| R-09 | Backend / Filtrado | Filtro `year` en `/periods-summary` no filtra correctamente → devuelve períodos de otros años | **MEDIO** | Resultados incorrectos afectan análisis histórico |
| R-10 | Frontend / Visual | Badge de tendencia muestra `↑ NaN%` cuando `variacion_porcentaje` es null | **MEDIO** | Información malformada visible al administrador |
| R-11 | Frontend / Visual | Barra de progreso supera el 100% cuando `porcentaje_recaudado > 100` | **MEDIO** | Inconsistencia visual que confunde estado de recaudación |
| R-12 | Frontend / Estado | Badge de estado no aplica clase CSS correcta para VENCIDO/CERRADO | **MEDIO** | Diferenciación visual fallida entre estados del período |
| R-13 | Frontend / Paginación | Botón de página siguiente no se deshabilita en última página | **BAJO** | Llamada extra al API sin resultado visible |
| R-14 | Frontend / Acción | Botón "+ Emitir Cuota Próximo Mes" no pre-carga el período correcto en el modal | **MEDIO** | Administrador emite cuota en período equivocado |
| R-15 | Frontend / Exportar | "Exportar Todo" no descarga CSV o descarga archivo vacío | **MEDIO** | Funcionalidad de reporte no operativa |
| R-16 | Frontend / Error | Error 500 del API no muestra mensaje ni botón de reintento | **ALTO** | Pantalla congelada o vacía sin posibilidad de recuperación |
| R-17 | Frontend / Edge | Período sin cuotas no muestra ceros → queda en estado de loading indefinido | **MEDIO** | Experiencia de usuario bloqueada |
| R-18 | Integración | Contrato del API response desalineado con lo que el hook espera (`data` vs `items`) | **ALTO** | Hook `usePeriodsSummary` usa `items`, backend devuelve `data` — discrepancia detectada en tests |

---

### Resumen por nivel

| Nivel | Cantidad | % del total |
|-------|----------|-------------|
| **ALTO** | 8 | 44 % |
| **MEDIO** | 7 | 39 % |
| **BAJO** | 1 | 6 % |
| **CRÍTICO** (ALTO + contrato API) | 9 | 50 % |

> **Nota de riesgo prioritario:** El riesgo R-18 (contrato API) fue identificado al revisar `usePeriodsSummary.test.js`, donde el mock responde con `{ items: [...], total: N }`, mientras que la spec define la respuesta del backend como `{ data: [...], total: N }`. Requiere verificación y alineación antes del release.

---

## 2. Casos Gherkin

### HU-01: Visualizar estadísticas del período actual

---

#### CRITERIO-1.1 — Cargar 3 cards del período actual (Happy Path)

```gherkin
Feature: Estadísticas del período actual en Gestión de Cuotas

  Background:
    Given que el usuario tiene rol "Administrador"
    And está autenticado con un token válido
    And la API GET /api/v1/apartment-fees/stats responde 200 con datos del período "2026-05"

  Scenario: Ver 3 cards de métricas al acceder a Gestión de Cuotas
    When el administrador navega a la ruta "/admin/fees"
    Then la página carga correctamente
    And se muestran 3 cards con los títulos:
      | card                |
      | TOTAL EMITIDO (MES) |
      | TOTAL RECAUDADO     |
      | PENDIENTE DE COBRO  |
    And cada card muestra un valor monetario formateado
```

**Datos de prueba:**
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

---

#### CRITERIO-1.2 — Badge de tendencia en Total Emitido (Happy Path)

```gherkin
  Scenario: Mostrar badge de tendencia positiva en card Total Emitido
    Given que el período actual tiene total_emitido de $1.240.500
    And el período anterior tenía total_emitido de $1.190.000
    When se carga la página de Gestión de Cuotas
    Then el card "TOTAL EMITIDO" muestra el badge "↑ 4.2% vs mes anterior"
    And el badge tiene color verde

  Scenario: Mostrar badge de tendencia negativa en card Total Emitido
    Given que el período actual tiene total_emitido de $1.000.000
    And el período anterior tenía total_emitido de $1.200.000
    When se carga la página de Gestión de Cuotas
    Then el card "TOTAL EMITIDO" muestra el badge "↓ 16.7% vs mes anterior"
    And el badge tiene color rojo

  Scenario: Ocultar badge cuando no existe período anterior
    Given que el período actual es el primero en el sistema (sin período anterior)
    When se carga la página de Gestión de Cuotas
    Then el card "TOTAL EMITIDO" no muestra ningún badge de tendencia
```

**Datos de prueba — tendencia negativa:**
```json
{ "tendencia_emitido": -16.7, "total_emitido": 1000000 }
```
**Datos de prueba — sin período anterior:**
```json
{ "tendencia_emitido": null }
```

---

#### CRITERIO-1.3 — Barra de progreso en Total Recaudado (Happy Path)

```gherkin
  Scenario: Mostrar barra de progreso con porcentaje de recaudación
    Given que total_recaudado es $892.300 sobre total_emitido de $1.240.500
    When se carga el card "TOTAL RECAUDADO"
    Then se muestra una barra de progreso al 72%
    And el label indica "72% del total emitido"
    And el ancho de la barra no supera el 100% visualmente

  Scenario: Barra de progreso al 100% cuando recaudación es total
    Given que total_recaudado es igual a total_emitido
    When se carga el card "TOTAL RECAUDADO"
    Then la barra de progreso muestra 100%
    And no se desborda visualmente del contenedor
```

---

#### CRITERIO-1.4 — Badge rojo con unidades en deuda en Pendiente de Cobro (Happy Path)

```gherkin
  Scenario: Mostrar badge rojo con unidades en deuda vencida
    Given que hay 12 apartamentos con saldo pendiente en períodos vencidos
    When se carga el card "PENDIENTE DE COBRO"
    Then se muestra un badge con el texto "12 unidades con deuda"
    And el badge tiene color rojo

  Scenario: Badge no se muestra cuando no hay unidades con deuda
    Given que unidades_deuda_vencida es 0
    When se carga el card "PENDIENTE DE COBRO"
    Then no se muestra badge de unidades con deuda
```

---

#### CRITERIO-1.5 — Error 500 con mensaje y botón retry (Error Path)

```gherkin
  Scenario: Mostrar mensaje de error y botón retry ante error 500 del API
    Given que la API GET /api/v1/apartment-fees/stats responde con código 500
    When el administrador accede a la página de Gestión de Cuotas
    Then se muestra un mensaje de error visible al usuario
    And se muestra un botón "Reintentar"
    And los cards no se renderizan con valores vacíos ni NaN

  Scenario: Reintentar carga después de error 500
    Given que la API inicialmente responde 500
    And el administrador hace clic en "Reintentar"
    And la API ahora responde 200
    Then las estadísticas se cargan correctamente
    And el mensaje de error desaparece
```

---

#### CRITERIO-1.6 — Período sin cuotas muestra ceros (Edge Case)

```gherkin
  Scenario: Mostrar ceros cuando el período no tiene cuotas emitidas
    Given que la API devuelve total_emitido=0, total_recaudado=0, unidades_deuda_vencida=0
    When se carga la página de Gestión de Cuotas
    Then los 3 cards muestran "$0" como valor
    And la barra de progreso muestra 0%
    And no se muestra badge de tendencia
    And no se muestra badge de unidades con deuda
    And el componente no queda en estado de carga indefinida
```

**Datos de prueba:**
```json
{
  "total_emitido": 0,
  "total_recaudado": 0,
  "pendiente_cobro": 0,
  "porcentaje_recaudado": 0,
  "unidades_deuda_vencida": 0,
  "tendencia_emitido": null
}
```

---

### HU-02: Consultar historial de períodos

---

#### CRITERIO-2.1 — Tabla paginada 10 registros/página (Happy Path)

```gherkin
Feature: Historial de períodos paginado

  Background:
    Given que el administrador está autenticado
    And la API GET /api/v1/apartment-fees/periods-summary responde con 24 períodos

  Scenario: Ver tabla con paginación de 10 registros por página
    When se carga la sección "HISTORIAL DE PERÍODOS"
    Then la tabla muestra exactamente 10 registros en la primera página
    And se muestran los controles de paginación
    And se indica la página actual "1"
    And hay un botón para ir a la página 2

  Scenario: Navegar a la segunda página
    Given que la tabla está en la página 1
    When el administrador hace clic en el botón de página "2"
    Then la tabla muestra los registros 11 al 20
    And la página actual indica "2"

  Scenario: Deshabilitar botón de página siguiente en última página
    Given que hay 24 períodos totales y el usuario está en la página 3 (registros 21-24)
    When se renderiza la paginación
    Then el botón "siguiente" está deshabilitado
```

**Datos de prueba:**
```json
{ "data": [ /* 24 items */ ], "total": 24, "page": 1, "page_size": 10 }
```

---

#### CRITERIO-2.2 — Badge de estado con colores (Happy Path)

```gherkin
  Scenario: Badge ABIERTO en color azul
    Given que un período tiene status "ABIERTO"
    When se renderiza la fila en la tabla
    Then se muestra el badge "ABIERTO" con clase CSS badge_ABIERTO (color azul)

  Scenario: Badge VENCIDO en color naranja
    Given que un período tiene status "VENCIDO"
    When se renderiza la fila en la tabla
    Then se muestra el badge "VENCIDO" con clase CSS badge_VENCIDO (color naranja)

  Scenario: Badge CERRADO en color gris
    Given que un período tiene status "CERRADO"
    When se renderiza la fila en la tabla
    Then se muestra el badge "CERRADO" con clase CSS badge_CERRADO (color gris)
```

---

#### CRITERIO-2.3 — Morosidad con barra visual (Happy Path)

```gherkin
  Scenario: Mostrar porcentaje de morosidad y barra visual
    Given que un período tiene total_emitido=1.180.000 y total_recaudado=950.000
    When se renderiza la fila del período "Marzo 2026"
    Then se muestra "19%" como porcentaje de morosidad
    And se muestra una barra visual proporcional al 19%
    And la barra de deuda tiene color rojo y la de pago color verde

  Scenario: Morosidad 0% cuando período está 100% recaudado
    Given que total_recaudado es igual a total_emitido
    When se renderiza la fila
    Then se muestra "0%" de morosidad
    And la barra visual es 100% verde
```

---

#### CRITERIO-2.4 — Error 400 en carga de períodos (Error Path)

```gherkin
  Scenario: Mensaje contextualizado ante error 400 del API de períodos
    Given que la API GET /api/v1/apartment-fees/periods-summary responde 400
    When se intenta cargar la tabla de historial
    Then se muestra un mensaje de error específico del contexto
    And la tabla no renderiza filas vacías ni estado de carga indefinido
```

---

### HU-03: Acciones rápidas y filtrado

---

#### CRITERIO-3.1 — Filtrar por año (Happy Path)

```gherkin
Feature: Filtrado y acciones rápidas en Gestión de Cuotas

  Scenario: Filtrar tabla de períodos por año
    Given que la tabla muestra períodos de 2025 y 2026
    When el administrador selecciona "2025" en el filtro "Filtrar Año"
    Then la API se llama con el parámetro year=2025
    And la tabla muestra únicamente períodos cuyo año es "2025"
    And todos los valores de la columna PERÍODO comienzan con "2025-"

  Scenario: Limpiar filtro de año muestra todos los períodos
    Given que el filtro de año está en "2025"
    When el administrador selecciona "Todos" en el filtro
    Then la API se llama sin el parámetro year
    And la tabla muestra períodos de todos los años disponibles
```

---

#### CRITERIO-3.2 — Botón emitir cuota próximo mes (Happy Path)

```gherkin
  Scenario: Abrir modal pre-cargado con el próximo mes
    Given que la fecha actual del sistema es mayo 2026 (2026-05)
    When el administrador hace clic en "+ Emitir Cuota Próximo Mes"
    Then se abre el modal de carga masiva
    And el campo período del modal está pre-cargado con "2026-06"

  Scenario: Próximo mes en diciembre avanza correctamente al año siguiente
    Given que la fecha actual del sistema es diciembre 2026 (2026-12)
    When el administrador hace clic en "+ Emitir Cuota Próximo Mes"
    Then el modal se abre con el período "2027-01"
```

---

#### CRITERIO-3.3 — Exportar CSV (Happy Path)

```gherkin
  Scenario: Descargar CSV con todos los períodos
    Given que la tabla tiene períodos cargados
    When el administrador hace clic en "Exportar Todo"
    Then se inicia la descarga de un archivo con extensión .csv
    And el archivo contiene las columnas: PERÍODO, ESTADO, EMITIDO, RECAUDADO, MOROSIDAD
    And el archivo incluye todos los períodos (no solo los de la página actual)

  Scenario: Exportar con filtro de año activo
    Given que el filtro de año está en "2025"
    When el administrador hace clic en "Exportar Todo"
    Then el archivo CSV contiene únicamente períodos del año 2025
```

---

### Casos de Seguridad (basados en riesgos R-04 y R-05)

```gherkin
Feature: Control de acceso a endpoints de estadísticas

  Scenario: Propietario no puede acceder a estadísticas
    Given que el usuario tiene rol "Propietario" con token válido
    When realiza GET /api/v1/apartment-fees/stats
    Then recibe respuesta 403 Forbidden
    And no se exponen datos financieros

  Scenario: Request sin token es rechazado
    Given que no se envía el header Authorization
    When se realiza GET /api/v1/apartment-fees/stats
    Then recibe respuesta 401 Unauthorized

  Scenario: Request sin token al endpoint de períodos
    Given que no se envía el header Authorization
    When se realiza GET /api/v1/apartment-fees/periods-summary
    Then recibe respuesta 401 Unauthorized

  Scenario: Token expirado es rechazado
    Given que el token JWT está expirado
    When se realiza GET /api/v1/apartment-fees/stats
    Then recibe respuesta 401 Unauthorized
```

---

### Casos de Validación de Contrato API (R-18)

```gherkin
Feature: Contrato del API entre backend y frontend

  Scenario: Hook usePeriodsSummary consume campo correcto del response
    Given que la API devuelve { "data": [...], "total": N }
    When el hook usePeriodsSummary procesa el response
    Then mapea correctamente el campo "data" (no "items") al estado periods
    And total se asigna correctamente

  Scenario: Ningún campo requerido del response es undefined en el frontend
    Given que la API devuelve el response completo de /apartment-fees/stats
    When StatsCard recibe las props desde useApartmentFeeStats
    Then ninguna prop muestra "undefined" ni "NaN" en pantalla
```

---

## 3. Propuesta de Automatización con ROI Estimado

### Criterios de priorización (DoR de Automatización)

Se evalúa: ejecución manual previa exitosa, caso documentado, datos identificados, ambiente estable, impacto de negocio.

---

### Matriz de candidatos para automatización

| ID | Caso | Tipo | Frecuencia manual | Esfuerzo impl. | Esfuerzo maint. | ROI |
|----|------|------|-------------------|---------------|-----------------|-----|
| AUTO-01 | CRITERIO-1.1 a 1.4: Happy path de cards | API + E2E | Con cada release | Bajo | Bajo | **ALTO** |
| AUTO-02 | CRITERIO-1.5: Error 500 y retry | API mock + E2E | Ocasional | Bajo | Bajo | **ALTO** |
| AUTO-03 | CRITERIO-1.6: Período sin cuotas (ceros) | API mock | Ocasional | Bajo | Bajo | **ALTO** |
| AUTO-04 | CRITERIO-2.1: Paginación 10 items | API + E2E | Con cada release | Medio | Bajo | **ALTO** |
| AUTO-05 | CRITERIO-2.2: Colores de badge de estado | Componente | Con cada release | Bajo | Bajo | **MEDIO** |
| AUTO-06 | CRITERIO-2.3: % morosidad y barra visual | Componente | Con cada release | Bajo | Bajo | **MEDIO** |
| AUTO-07 | CRITERIO-3.1: Filtro por año → llamada API | Hook + E2E | Con cada release | Medio | Bajo | **ALTO** |
| AUTO-08 | CRITERIO-3.2: Modal pre-cargado próximo mes | E2E | Con cada release | Bajo | Bajo | **ALTO** |
| AUTO-09 | CRITERIO-3.3: Exportar CSV | E2E | Ocasional | Medio | Medio | **MEDIO** |
| AUTO-10 | R-04: Control de acceso rol PROPIETARIO | API | Con cada release | Bajo | Muy bajo | **ALTO** |
| AUTO-11 | R-05: Acceso sin token → 401 | API | Con cada release | Muy bajo | Muy bajo | **ALTO** |
| AUTO-12 | R-18: Contrato API data vs items | Contract test | Con cada deploy | Bajo | Muy bajo | **CRÍTICO** |

---

### Hoja de ruta de automatización

#### Fase 1 — Inmediata (sprint actual)
**Objetivo:** Cubrir todos los riesgos ALTO y los flujos críticos financieros.

Candidatos: AUTO-01, AUTO-02, AUTO-03, AUTO-10, AUTO-11, AUTO-12

**Framework recomendado:** Pytest (backend ya configurado) + Vitest + React Testing Library (frontend ya configurado).

**ROI estimado Fase 1:**
- Tiempo ejecución manual: ~45 min/ciclo
- Tiempo ejecución automatizada: ~2 min/ciclo
- Ciclos por sprint: ~8
- Ahorro por sprint: ~344 min ≈ 5.7 horas
- Inversión estimada: 6 horas de implementación
- **Break-even: 1 sprint**

#### Fase 2 — Corto plazo (próximo sprint)
**Objetivo:** Cubrir flujos de UX, paginación y filtrado.

Candidatos: AUTO-04, AUTO-07, AUTO-08

**Framework adicional recomendado:** Playwright (E2E) para flujos de interacción completa.

**ROI estimado Fase 2:**
- Tiempo ejecución manual: ~30 min/ciclo
- Tiempo ejecución automatizada: ~3 min/ciclo
- Ciclos por sprint: ~8
- Ahorro por sprint: ~216 min ≈ 3.6 horas
- Inversión estimada: 10 horas de implementación
- **Break-even: 3 sprints**

#### Fase 3 — Mediano plazo
**Objetivo:** Completar cobertura de componentes y exportación.

Candidatos: AUTO-05, AUTO-06, AUTO-09

**ROI estimado Fase 3:**
- Ahorro por sprint: ~1.5 horas
- Inversión estimada: 8 horas
- **Break-even: 5-6 sprints**

---

### Arquitectura de automatización sugerida

```
tests/
  unit/
    backend/             ← pytest (ya existe, cubrir R-02, R-03)
    frontend/            ← vitest + RTL (ya existe, cubrir R-10, R-11)
  integration/
    api/                 ← pytest + httpx (AUTO-10, AUTO-11, AUTO-12)
  e2e/
    fees/
      stats-cards.spec.ts       ← Playwright (AUTO-01, AUTO-02)
      periods-table.spec.ts     ← Playwright (AUTO-04, AUTO-07, AUTO-08)
      export.spec.ts            ← Playwright (AUTO-09)
  contract/
    api-contract.test.ts        ← Pact o schema validation (AUTO-12)
```

---

## 4. Análisis de Performance

### SLAs de referencia (derivados de la spec)

Los endpoints nuevos sirven un dashboard financiero con carga al iniciar sesión del administrador. Se asumen los siguientes umbrales de negocio:

| Métrica | Umbral objetivo | Umbral crítico |
|---------|----------------|----------------|
| Latencia P95 — `/apartment-fees/stats` | ≤ 500 ms | > 1.500 ms |
| Latencia P95 — `/apartment-fees/periods-summary` | ≤ 800 ms | > 2.000 ms |
| Tasa de error bajo carga normal | < 0.5 % | > 1 % |
| Throughput sostenido (usuarios concurrentes) | 50 VU | 100 VU |

---

### Escenarios de prueba de carga

#### Escenario 1 — Carga base (Load Test)

**Objetivo:** Verificar que los endpoints cumplen SLA bajo carga normal.

```
Duración total: 10 minutos
Ramp-up:        2 min → 0 a 50 VU
Plateau:        6 min → 50 VU constantes
Ramp-down:      2 min → 50 a 0 VU

Endpoints:
  - GET /api/v1/apartment-fees/stats?period=2026-05         (70% del tráfico)
  - GET /api/v1/apartment-fees/periods-summary?page=1       (30% del tráfico)

Thresholds k6:
  http_req_duration{url:/apartment-fees/stats}:           ["p(95)<500"]
  http_req_duration{url:/apartment-fees/periods-summary}: ["p(95)<800"]
  http_req_failed:                                        ["rate<0.005"]
```

#### Escenario 2 — Prueba de estrés (Stress Test)

**Objetivo:** Identificar el punto de quiebre y comportamiento bajo carga máxima.

```
Duración total: 15 minutos
Ramp-up:        5 min → 0 a 200 VU
Plateau:        5 min → 200 VU constantes
Ramp-down:      5 min → 200 a 0 VU

Observar:
  - Latencia P99 bajo 200 VU
  - Tasa de errores 5xx
  - Comportamiento de la BD (conexiones máximas)
```

#### Escenario 3 — Spike Test

**Objetivo:** Verificar que el sistema no degrada la API de cuotas existente cuando el dashboard genera carga simultánea.

```
Baseline: 20 VU durante 2 min
Spike:    + 150 VU en 10 segundos
Plateau:  150 VU durante 1 min
Recovery: bajar a 20 VU en 10 segundos
Observar: recuperación y sin errores en endpoints existentes
```

---

### Consultas SQL de riesgo (punto de atención)

Los endpoints de estadísticas ejecutan múltiples `SUM` y `COUNT DISTINCT` sobre tablas sin índices optimizados en todos los filtros. Los índices definidos en la spec son:

- `idx_apartment_fees_period` sobre `(period)`
- `idx_payments_period_status` sobre `(period, status)`

**Validar antes de ejecución de performance:**
1. Confirmar que los índices están creados en el ambiente de prueba.
2. Ejecutar `EXPLAIN ANALYZE` sobre las queries de stats con dataset representativo (mínimo 1.000 registros de `apartment_fees` y 500 de `payments`).
3. Si `seq_scan` aparece en el plan para tablas grandes, forzar creación de índice antes de las pruebas.

---

### Observabilidad durante las pruebas

| Métrica | Herramienta | Alerta |
|---------|------------|--------|
| Latencia por endpoint | k6 + Grafana | P95 > umbral crítico |
| CPU del servidor | Infra monitoring | > 80% sostenido |
| Conexiones DB abiertas | pg_stat_activity | > 80% del pool |
| Errores 5xx | Logs de la app | Cualquier ocurrencia |

---

### Script k6 — Plantilla base

```javascript
// k6-stats-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const statsLatency = new Trend('stats_latency', true);
const periodsLatency = new Trend('periods_latency', true);

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '6m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    stats_latency: ['p(95)<500'],
    periods_latency: ['p(95)<800'],
    errors: ['rate<0.005'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const TOKEN = __ENV.ADMIN_TOKEN;

export default function () {
  const headers = { Authorization: `Bearer ${TOKEN}` };

  if (Math.random() < 0.7) {
    const res = http.get(`${BASE_URL}/api/v1/apartment-fees/stats?period=2026-05`, { headers });
    statsLatency.add(res.timings.duration);
    check(res, { 'stats 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  } else {
    const res = http.get(`${BASE_URL}/api/v1/apartment-fees/periods-summary?page=1`, { headers });
    periodsLatency.add(res.timings.duration);
    check(res, { 'periods 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  }

  sleep(1);
}
```

> **Nota de seguridad:** El token de administrador debe gestionarse como secreto en bóveda (ej. GitHub Secrets, Vault). Nunca incluirlo en texto plano en el repositorio.

---

## 5. Resumen Ejecutivo

| Dimensión | Estado | Acción requerida |
|-----------|--------|-----------------|
| Cobertura unitaria backend | 12 tests — VERDE | Sin acción |
| Cobertura unitaria frontend | 21 tests — VERDE | Sin acción |
| Riesgos ALTO identificados | 8 riesgos | Validar R-02, R-03, R-16, R-18 antes del release |
| Contrato API (R-18) | Discrepancia detectada (`data` vs `items`) | Alinear hook o backend antes del merge |
| Automatización E2E | No existe | Implementar Fase 1 en sprint actual |
| Performance | Sin pruebas ejecutadas | Crear ambiente + dataset antes del release |
| Control de acceso | Cubierto en tests unitarios | Incluir en regresión automática |

### Criterio de listo para release (DoD QA)

- [ ] R-18 resuelto: contrato API alineado entre backend y frontend
- [ ] R-02 verificado: sin división por cero cuando total_emitido = 0
- [ ] R-16 verificado: error 500 muestra mensaje + retry en pantalla
- [ ] Prueba de carga Escenario 1 ejecutada y P95 dentro de SLA
- [ ] Suite de automatización Fase 1 integrada al pipeline CI
- [ ] Revisión exploratoria de 30 min en ambiente staging con datos reales

---

*Documento generado por QA Agent — metodología ASDD | 2026-05-21*
