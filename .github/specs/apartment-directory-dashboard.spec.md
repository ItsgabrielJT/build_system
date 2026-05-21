---
id: SPEC-001
status: APPROVED
feature: apartment-directory-dashboard
created: 2026-05-21
updated: 2026-05-21
author: spec-generator
version: "1.0"
related-specs: []
---

# Spec: Módulo Directorio de Departamentos y Propietarios

> **Estado:** `APPROVED` → aprobar con `status: APPROVED` antes de iniciar implementación.
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED → DEPRECATED

---

## 1. REQUERIMIENTOS

### Descripción

Redisenar dos páginas complementarias para la gestión visual integral del edificio:

1. **Página Departamentos**: Dashboard que visualiza el estado operativo de todos los departamentos con estadísticas de ocupación, tarjetas por unidad y paginación.
2. **Página Directorio de Propietarios**: Listado centralizado de propietarios con contacto, unidades asignadas, historial de ingresos y balance actual.

Ambas páginas deben consumir APIs dedicadas en el backend que retornen datos estructurados para replicar exactamente el diseño especificado.

### Requerimiento de Negocio

El usuario ADMIN requiere:
- Visualizar en tiempo real la distribución de ocupación del edificio (ocupados, vacantes, en mantenimiento).
- Identificar rápidamente el estado de cada departamento mediante tarjetas con iconografía, ubicación, área y alícuota asignada.
- Acceder a un directorio centralizado de propietarios con información de contacto, unidades a su cargo, fecha de ingreso y balance de cuenta.
- Exportar información del directorio para auditoría y gestión administrativa.

---

## 2. HISTORIAS DE USUARIO

### HU-01: Visualizar Dashboard de Departamentos con Estadísticas

```
Como:        Administrador
Quiero:      Acceder a una página de Departamentos que muestre estadísticas 
             de ocupación (ocupados, vacantes, mantenimiento) y una lista 
             de tarjetas por unidad
Para:        Monitorear rápidamente el estado operativo de los departamentos 
             del edificio

Prioridad:   Alta
Estimación:  M
Dependencias: Ninguna
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-01

**CRITERIO-1.1: Cargar estadísticas de ocupación**
```gherkin
Dado que:  El usuario ADMIN accede a la página /departments
Cuando:    La página se carga
Entonces:  Se muestran 4 tarjetas de resumen:
           - Total Ocupados (con porcentaje de ocupación)
           - Total Vacantes (disponibles ahora)
           - En Mantenimiento (en revisión)
           - Alícuota Total (% distribuido)
           Y cada tarjeta muestra iconografía descriptiva y color distintivo
```

**CRITERIO-1.2: Listar departamentos en tarjetas paginadas**
```gherkin
Dado que:  Las estadísticas se han cargado exitosamente
Cuando:    El usuario visualiza la sección de unidades
Entonces:  Se muestran tarjetas con:
           - Código de unidad (ej. Unit 101, Unit 204, Unit 3C)
           - Estado de ocupación (OCUPADO / VACANTE / MANTENIMIENTO) 
             con color distintivo (verde/azul/naranja)
           - Ubicación (Piso, Torre)
           - Área (m²)
           - Alícuota asignada (%)
           - Foto/Imagen de referencia (si aplica)
           Y cada tarjeta es seleccionable para ver detalles
```

**CRITERIO-1.3: Paginar lista de departamentos**
```gherkin
Dado que:  El usuario visualiza más de 4 departamentos
Cuando:    La página muestra paginación al pie
Entonces:  Se muestran botones de navegación (Anterior, números, Siguiente)
           Y cada página muestra 4 departamentos por defecto
           Y el usuario puede navegar entre páginas sin recargar la información
```

**CRITERIO-1.4: Filtrar departamentos por estado**
```gherkin
Dado que:  El usuario ve la lista de departamentos
Cuando:    Aplica un filtro por "Todos", "Ocupados", "Vacantes", "Mantenimiento"
Entonces:  La lista se filtra inmediatamente
           Y se actualiza el recuento de ocupación en las tarjetas de resumen
           Y la paginación se reinicia en página 1
```

**CRITERIO-1.5: Error - No hay datos**
```gherkin
Dado que:  No existen departamentos registrados en el sistema
Cuando:    El usuario accede a la página /departments
Entonces:  Se muestra un mensaje: "No hay departamentos registrados"
           Y se sugiere crear uno mediante un botón de acción
```

---

### HU-02: Visualizar Directorio de Propietarios con Balance

```
Como:        Administrador
Quiero:      Acceder a un directorio centralizado de propietarios 
             con su información de contacto, unidades asignadas, 
             fecha de ingreso y balance actual
Para:        Gestionar el relacionamiento con propietarios y hacer 
             seguimiento de cuentas corrientes

Prioridad:   Alta
Estimación:  M
Dependencias: Ninguna
Capa:        Backend + Frontend
```

#### Criterios de Aceptación — HU-02

**CRITERIO-2.1: Cargar directorio de propietarios**
```gherkin
Dado que:  El usuario ADMIN accede a /owners
Cuando:    La página se carga
Entonces:  Se muestra un listado tabular con columnas:
           - PROPIETARIO (nombre)
           - UNIDAD (códigos de unidades asignadas)
           - CONTACTO (email + teléfono, copiables)
           - INGRESO (fecha de asociación al edificio)
           - BALANCE (saldo actual: verde si ≥0, rojo si <0)
           - ACCIONES (Ver, Editar, Eliminar)
           Y cada fila es del propietario
```

**CRITERIO-2.2: Mostrar información de contacto**
```gherkin
Dado que:  Un propietario tiene asignado email y teléfono
Cuando:    El usuario visualiza la fila del propietario
Entonces:  Se muestran en columna CONTACTO:
           - Email (con icono de correo, copiable al pasar el mouse)
           - Teléfono (con icono de teléfono, copiable al pasar el mouse)
           Y si no tiene correo o teléfono, muestra "-"
```

**CRITERIO-2.3: Calcular y mostrar balance por propietario**
```gherkin
Dado que:  Un propietario tiene múltiples departamentos
Cuando:    Se calcula el BALANCE del propietario
Entonces:  El balance es la suma de saldos de todos sus departamentos
           (sum de: Esperado + Multas - Pagado por período)
           Y se muestra en color VERDE si balance ≥ 0
           Y se muestra en color ROJO si balance < 0
           Y el número se formatea con separador de miles (ej. -$42.500)
```

**CRITERIO-2.4: Acciones en directorio**
```gherkin
Dado que:  El usuario está en el directorio
Cuando:    Hace clic en "Ver" en la columna ACCIONES
Entonces:  Se abre un modal con detalles completos del propietario:
           - Información personal (nombre, documento, teléfono, email)
           - Listado de unidades asignadas con su estado
           - Historial de ingresos/egresos (últimas 3 transacciones)
           - Balance consolidado
           Y hay botón "Descargar Estado de Cuenta (PDF)"
```

**CRITERIO-2.5: Paginación del directorio**
```gherkin
Dado que:  El directorio tiene más de 10 propietarios
Cuando:    La página muestra paginación
Entonces:  Se muestran 10 propietarios por página
           Y se puede navegar con botones (Anterior, números, Siguiente)
           Y se actualiza el listado sin recargar la página
```

**CRITERIO-2.6: Buscar/Filtrar propietarios**
```gherkin
Dado que:  El usuario accede al directorio
Cuando:    Escribe en un campo de búsqueda
Entonces:  El listado se filtra en tiempo real por:
           - Nombre del propietario (búsqueda parcial)
           - Email
           - Teléfono
           Y se reinicia la paginación en página 1
```

**CRITERIO-2.7: Error - Sin propietarios**
```gherkin
Dado que:  No hay propietarios registrados
Cuando:    El usuario accede a /owners-directory
Entonces:  Se muestra un mensaje: "No hay propietarios registrados"
           Y se sugiere crear uno mediante un botón de acción
```

---

## 3. REGLAS DE NEGOCIO

1. **Estado de ocupación**: Un departamento es OCUPADO si tiene owner_id asignado y status='ACTIVA', VACANTE si status='ACTIVA' sin owner, MANTENIMIENTO si status='MANTENIMIENTO'.

2. **Paginación por defecto**: Departamentos: 4 por página. Propietarios: 10 por página. Ambas configurables desde env/settings.

3. **Balance consolidado**: El balance de un propietario es la suma algebráica de balances de todos sus departamentos en todos los períodos.

4. **Información visible por rol**: ADMIN ve todos los departamentos y propietarios. PROPIETARIO ve solo sus propios departamentos.

5. **Formato de período**: Todo período se maneja como YYYY-MM. Las fechas de ingreso se formatean como DD/MM/YYYY en frontend.

6. **Contacto copiable**: Email y teléfono son copiables al pasar el mouse (tooltip "Copiar al portapapeles").

7. **Colores de balance**: Verde (#27AE60) si balance ≥ 0, Rojo (#E74C3C) si balance < 0.

---

## 4. DISEÑO

### Modelos de Datos Existentes

Los siguientes modelos ya existen en el sistema:

| Modelo | Almacén | Uso |
|--------|---------|-----|
| `Owner` | `owners` | Propietarios del edificio |
| `Apartment` | `apartments` | Departamentos/unidades |
| `ApartmentFee` | `apartment_fees` | Cuotas esperadas por período |
| `Payment` | `payments` | Pagos registrados |
| `Fine` | `fines` | Multas por departamento-período |

**Nuevas entidades requeridas**: Ninguna. Se reutilizan esquemas existentes.

#### Nuevos campos o índices requeridos

En colección `apartments`:
- Asegurar índice en `status` para filtrado rápido.
- Asegurar índice en `owner_id` para búsquedas.
- Asegurar índice en `building_id`.

En colección `owners`:
- Asegurar índice en `email` para búsqueda.
- Asegurar índice en `phone` para búsqueda.
- Asegurar índice en `status` para filtrado.

En colección `payments`:
- Asegurar índice compuesto `(apartment_id, period)` para cálculo de saldos.

En colección `fines`:
- Asegurar índice compuesto `(apartment_id, period)` para cálculo de saldos.

### API Endpoints

#### GET /api/v1/apartments/statistics

**Descripción**: Retorna estadísticas de ocupación del edificio.

**Auth requerida**: Sí (ADMIN)

**Response 200**:
```json
{
  "total": 48,
  "occupied": 42,
  "vacant": 4,
  "maintenance": 2,
  "occupancy_rate_percent": 87.5,
  "allocated_quota_percent": 100.0
}
```

**Response 401**: Token ausente o expirado.

**Response 403**: Usuario no es ADMIN.

---

#### GET /api/v1/apartments

**Descripción**: Retorna lista paginada de departamentos con estado.

**Auth requerida**: Sí (ADMIN o PROPIETARIO de sus propias unidades)

**Query Params**:
- `page` (int, default=1): Número de página.
- `per_page` (int, default=4): Ítems por página.
- `status` (str, optional): Filtro por estado (OCUPADO, VACANTE, MANTENIMIENTO).
- `building_id` (UUID, optional): Filtro por edificio.

**Response 200**:
```json
{
  "total": 48,
  "page": 1,
  "per_page": 4,
  "total_pages": 12,
  "items": [
    {
      "id": "uuid-1",
      "code": "Unit 101",
      "floor": 1,
      "tower": "A",
      "area_sqm": 85.0,
      "status": "OCUPADO",
      "owner_name": "Ricardo Cavacalanti",
      "allocated_quota_percent": 2.145,
      "image_url": "https://cdn.example.com/apt-101.jpg"
    },
    {
      "id": "uuid-2",
      "code": "Unit 204",
      "floor": 2,
      "tower": "B",
      "area_sqm": 112.5,
      "status": "VACANTE",
      "owner_name": null,
      "allocated_quota_percent": 2.145,
      "image_url": null
    }
  ]
}
```

**Response 401**: No autenticado.

**Response 403**: PROPIETARIO accediendo a departamentos ajenos.

**Response 404**: Edificio no encontrado.

---

#### GET /api/v1/owners/directory

**Descripción**: Retorna listado paginado de propietarios con balance consolidado.

**Auth requerida**: Sí (ADMIN)

**Query Params**:
- `page` (int, default=1): Número de página.
- `per_page` (int, default=10): Ítems por página.
- `search` (str, optional): Búsqueda por nombre, email o teléfono.

**Response 200**:
```json
{
  "total": 15,
  "page": 1,
  "per_page": 10,
  "total_pages": 2,
  "items": [
    {
      "id": "uuid-owner-1",
      "full_name": "Ricardo Cavacalanti",
      "document_id": "80.234.560",
      "email": "rcavacalanti@gmail.com",
      "phone": "+54 11 4920-3321",
      "units": [
        {
          "id": "uuid-apt-1",
          "code": "Unit 1204",
          "tower": "A",
          "floor": 12
        }
      ],
      "ingress_date": "2021-03-12",
      "balance": 0.0,
      "currency": "USD"
    },
    {
      "id": "uuid-owner-2",
      "full_name": "Ana María López",
      "document_id": "18.223.430",
      "email": "am.lopez@gmail.com",
      "phone": "+54 11 5562-1182",
      "units": [
        {
          "id": "uuid-apt-2",
          "code": "Unit 0302",
          "tower": "B",
          "floor": 3
        }
      ],
      "ingress_date": "2019-06-15",
      "balance": -42500.0,
      "currency": "USD"
    }
  ]
}
```

**Response 401**: No autenticado.

**Response 403**: Usuario no es ADMIN.

---

#### GET /api/v1/owners/{owner_id}/detail

**Descripción**: Retorna detalles completos de un propietario incluyendo transacciones recientes.

**Auth requerida**: Sí (ADMIN)

**Response 200**:
```json
{
  "id": "uuid-owner-1",
  "full_name": "Ricardo Cavacalanti",
  "document_id": "80.234.560",
  "email": "rcavacalanti@gmail.com",
  "phone": "+54 11 4920-3321",
  "status": "ACTIVO",
  "units": [
    {
      "id": "uuid-apt-1",
      "code": "Unit 1204",
      "tower": "A",
      "floor": 12,
      "status": "OCUPADO",
      "area_sqm": 125.5
    }
  ],
  "ingress_date": "2021-03-12",
  "balance_consolidated": 0.0,
  "recent_transactions": [
    {
      "type": "PAYMENT",
      "period": "2026-05",
      "amount": 1500.0,
      "date": "2026-05-10",
      "reference": "Pago cuota mayo"
    },
    {
      "type": "FINE",
      "period": "2026-05",
      "amount": 50.0,
      "date": "2026-05-08",
      "reference": "Multa por retraso"
    }
  ],
  "currency": "USD"
}
```

---

### Diseño Frontend

#### Componentes Nuevos

| Componente | Ruta | Props principales | Descripción |
|------------|------|------------------|-------------|
| `DepartmentStats` | `components/DepartmentStats` | `statistics, loading` | Tarjetas de resumen de ocupación |
| `ApartmentCard` | `components/ApartmentCard` | `apartment, onSelect` | Tarjeta individual de departamento |
| `ApartmentGrid` | `components/ApartmentGrid` | `apartments, loading, onSelect` | Grid paginado de departamentos |
| `OwnerDirectoryTable` | `components/OwnerDirectoryTable` | `owners, onView, onEdit, onDelete, loading` | Tabla de propietarios |
| `OwnerDetailModal` | `components/OwnerDetailModal` | `owner, isOpen, onClose` | Modal con detalles de propietario |
| `ContactCopy` | `components/ContactCopy` | `value, type` | Campo de contacto copiable |

#### Páginas Nuevas

| Página | Ruta | Protegida | Roles autorizados |
|--------|------|-----------|------------------|
| `DepartmentsPage` | `/departments` | Sí | ADMIN |
| `OwnersDirectoryPage` | `/owners-directory` | Sí | ADMIN |

#### Hooks Necesarios

| Hook | Ruta | Retorna | Descripción |
|------|------|---------|-------------|
| `useApartments` | `hooks/useApartments` | `{ apartments, page, totalPages, stats, loading, error, filter, setFilter, goToPage }` | Gestión de estado de departamentos |
| `useOwnerDirectory` | `hooks/useOwnerDirectory` | `{ owners, page, totalPages, loading, error, search, setSearch, goToPage, selectedOwner, openDetail, closeDetail }` | Gestión de estado del directorio |

#### Services (Llamadas API)

| Función | Ruta | Endpoint | Método |
|---------|------|---------|--------|
| `getApartmentStatistics(token)` | `services/apartmentService` | `GET /api/v1/apartments/statistics` | GET |
| `getApartments(page, perPage, status, token)` | `services/apartmentService` | `GET /api/v1/apartments` | GET |
| `getOwnerDirectory(page, perPage, search, token)` | `services/ownerService` | `GET /api/v1/owners/directory` | GET |
| `getOwnerDetail(ownerId, token)` | `services/ownerService` | `GET /api/v1/owners/{owner_id}/detail` | GET |

#### CSS Modules

- `DepartmentsPage.module.css` — Layout principal, grilla de tarjetas, paginación.
- `OwnersDirectoryPage.module.css` — Tabla, búsqueda, modal.
- `DepartmentStats.module.css` — Tarjetas de resumen con colores y iconos.
- `ApartmentCard.module.css` — Tarjeta de departamento con estado badge.
- `OwnerDetailModal.module.css` — Modal desplegable con tabs.

---

### Arquitectura y Dependencias

**Paquetes nuevos requeridos**: Ninguno (usar axios, react-router v6 existentes).

**Servicios externos**: Ninguno nuevo.

**Impacto en rutas existentes**:
- Ampliar `app/routes/apartments.py` con endpoint `/statistics`.
- Ampliar `app/routes/owners.py` con endpoint `/directory` y `/{owner_id}/detail`.

**Impacto en App.jsx**:
- Registrar nuevas rutas en React Router.

---

## 5. NOTAS DE IMPLEMENTACIÓN

### Backend

1. **Cálculo de estadísticas**: Hacer el conteo en base de datos (aggregation pipeline en MongoDB) para performance, no en aplicación.

2. **Balance consolidado de propietario**: 
   - Recorrer todos los departamentos del propietario.
   - Para cada período, calcular: (Cuota + Multas) - Pagos.
   - Sumar todos los períodos.
   - Cachear este valor si es posible para no recalcular en cada request.

3. **Indexación crítica**: Asegurar índices compuestos en `(apartment_id, period)` en colecciones `payments` y `fines` para queries rápidas.

4. **Paginación**: Usar offset/limit en MongoDB. Considerar cursor-based pagination si hay millones de registros.

5. **Búsqueda**: Usar regex case-insensitive para búsqueda de nombre/email/teléfono. Considerar índices de texto si se requiere búsqueda avanzada.

### Frontend

1. **Estado compartido**: Usar hooks personalizados (`useApartments`, `useOwnerDirectory`) en lugar de Context para evitar re-renders innecesarios.

2. **Carga incremental**: Cargar estadísticas y lista en paralelo (Promise.all) para mejor UX.

3. **Debounce en búsqueda**: Debounce de 300ms en campo de búsqueda antes de hacer request.

4. **Colores de estado**:
   - OCUPADO: Verde (#27AE60)
   - VACANTE: Azul (#3498DB)
   - MANTENIMIENTO: Naranja (#E67E22)

5. **Balance color**:
   - ≥ 0: Verde (#27AE60)
   - < 0: Rojo (#E74C3C)

6. **Responsive**: Grid de departamentos adapta columnas en mobile (1 col), tablet (2 cols), desktop (4 cols).

---

## 6. LISTA DE TAREAS

> Checklist accionable. Marcar cada ítem (`[x]`) al completarlo.

### Backend

#### Implementación

- [ ] Crear o actualizar `ApartmentStatisticsResponse` en `app/models/schemas.py`
- [ ] Crear o actualizar `ApartmentDirectoryResponse` en `app/models/schemas.py`
- [ ] Crear o actualizar `OwnerDirectoryResponse` en `app/models/schemas.py`
- [ ] Crear o actualizar `OwnerDetailResponse` con transacciones recientes en `app/models/schemas.py`
- [ ] Implementar método `get_statistics()` en `ApartmentRepository` (aggregation)
- [ ] Implementar método `get_by_filter_paginated()` en `ApartmentRepository`
- [ ] Implementar método `get_directory_paginated()` en `OwnerRepository`
- [ ] Implementar método `get_detail_with_transactions()` en `OwnerRepository`
- [ ] Implementar `get_apartment_statistics()` en `ApartmentService`
- [ ] Implementar `get_apartments_paginated()` en `ApartmentService`
- [ ] Implementar `get_owner_directory()` en `OwnerService`
- [ ] Implementar `get_owner_detail()` en `OwnerService` con cálculo de balance consolidado
- [ ] Crear/Actualizar endpoint `GET /api/v1/apartments/statistics` en `app/routes/apartments.py`
- [ ] Crear/Actualizar endpoint `GET /api/v1/apartments` con query params en `app/routes/apartments.py`
- [ ] Crear/Actualizar endpoint `GET /api/v1/owners/directory` en `app/routes/owners.py`
- [ ] Crear/Actualizar endpoint `GET /api/v1/owners/{owner_id}/detail` en `app/routes/owners.py`
- [ ] Validar paginación y límites (page ≥ 1, per_page entre 1-100)
- [ ] Validar autenticación ADMIN en todos los endpoints nuevos

#### Tests Backend

- [ ] `test_apartment_statistics_returns_correct_counts` — validar conteo de ocupados/vacantes
- [ ] `test_apartment_statistics_requires_admin` — verificar autorización
- [ ] `test_get_apartments_paginated_returns_page_1` — validar primera página
- [ ] `test_get_apartments_paginated_filter_by_status` — validar filtro por estado
- [ ] `test_get_apartments_paginated_invalid_page_returns_400` — validar validación
- [ ] `test_owner_directory_returns_correct_balance` — validar cálculo de balance consolidado
- [ ] `test_owner_directory_search_by_name` — validar búsqueda
- [ ] `test_owner_directory_requires_admin` — verificar autorización
- [ ] `test_get_owner_detail_returns_recent_transactions` — validar transacciones

### Frontend

#### Componentes

- [ ] Crear `components/DepartmentStats.jsx` con 4 tarjetas de resumen
- [ ] Crear `components/DepartmentStats.module.css` con grid y colores
- [ ] Crear `components/ApartmentCard.jsx` con estado badge
- [ ] Crear `components/ApartmentCard.module.css` con imagen, ubicación, área
- [ ] Crear `components/ApartmentGrid.jsx` con paginación
- [ ] Crear `components/ApartmentGrid.module.css` con grid responsive
- [ ] Crear `components/OwnerDirectoryTable.jsx` con tabla paginada
- [ ] Crear `components/OwnerDirectoryTable.module.css` con colores de balance
- [ ] Crear `components/ContactCopy.jsx` con tooltip "Copiar"
- [ ] Crear `components/ContactCopy.module.css`
- [ ] Crear `components/OwnerDetailModal.jsx` con detalles y transacciones
- [ ] Crear `components/OwnerDetailModal.module.css`

#### Páginas

- [ ] Crear `pages/DepartmentsPage.jsx` que integre DepartmentStats + ApartmentGrid
- [ ] Crear `pages/DepartmentsPage.module.css`
- [ ] Crear `pages/OwnersDirectoryPage.jsx` que integre búsqueda + tabla + modal
- [ ] Crear `pages/OwnersDirectoryPage.module.css`

#### Hooks

- [ ] Crear `hooks/useApartments.js` con estado y métodos CRUD
- [ ] Crear `hooks/useOwnerDirectory.js` con estado y búsqueda
- [ ] Validar manejo de errores y loading states

#### Services

- [ ] Extender `services/apartmentService.js` con `getApartmentStatistics()`
- [ ] Extender `services/apartmentService.js` con `getApartments(page, perPage, status, token)`
- [ ] Extender `services/ownerService.js` con `getOwnerDirectory(page, perPage, search, token)`
- [ ] Extender `services/ownerService.js` con `getOwnerDetail(ownerId, token)`
- [ ] Validar manejo de tokens en headers

#### Rutas y Integración

- [ ] Registrar ruta `/departments` en `src/App.jsx` con `ProtectedRoute`
- [ ] Registrar ruta `/owners-directory` en `src/App.jsx` con `ProtectedRoute`
- [ ] Verificar que ambas rutas sean accesibles desde el menú lateral/navegación

#### Tests Frontend

- [ ] `test_DepartmentsPage_loads_statistics_on_mount` — validar carga inicial
- [ ] `test_DepartmentsPage_filter_updates_list` — validar filtro por estado
- [ ] `test_DepartmentStats_shows_4_cards` — validar tarjetas
- [ ] `test_ApartmentCard_shows_all_fields` — validar campos
- [ ] `test_OwnersDirectoryPage_loads_directory_on_mount` — validar carga inicial
- [ ] `test_OwnersDirectoryPage_search_filters_by_name` — validar búsqueda
- [ ] `test_OwnerDirectoryTable_shows_correct_balance_color` — validar colores
- [ ] `test_OwnerDetailModal_opens_on_view_click` — validar modal
- [ ] `test_ContactCopy_copies_to_clipboard` — validar copia

#### CSS y Estilos

- [ ] Validar diseño responsive en mobile (320px), tablet (768px), desktop (1920px)
- [ ] Validar colores de estado y balance según especificación
- [ ] Validar tipografía y espaciado consistente

---

## Activación del Agente

Para regenerar este documento usar en Copilot Chat:

```
/generate-spec
```

Este comando activa el Spec Generator basado en metodología ASDD.
