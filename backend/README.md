# Backend — MVP Gestión de Edificios

FastAPI + asyncpg + PostgreSQL.

## Requisitos previos

- Python 3.11+
- PostgreSQL 14+ corriendo localmente (o Docker)

## Configuración rápida

```bash
# 1. Crear entorno virtual e instalar dependencias
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Variables de entorno
cp .env.example .env
# Editar .env con tu DATABASE_URL y mantener DEV_MODE=true para desarrollo

# 3. Crear la base de datos en PostgreSQL
psql -U postgres -c "CREATE DATABASE edificios;"

# 4. Ejecutar la migración inicial
psql -U postgres -d edificios -f migrations/init.sql

# 5. Arrancar el servidor
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El servidor queda en **http://localhost:8000**.
Documentación interactiva: **http://localhost:8000/docs**

## Variables de entorno (`.env`)

| Variable | Descripción | Defecto |
|---|---|---|
| `DATABASE_URL` | DSN de PostgreSQL | `postgresql://postgres:postgres@localhost:5432/edificios` |
| `DEV_MODE` | `true` omite verificación JWT (solo dev) | `true` |
| `FIREBASE_PROJECT_ID` | ID del proyecto Firebase (producción) | vacío |
| `CORS_ORIGINS` | Orígenes permitidos separados por coma | `localhost:5173,5174,5175` |
| `DUE_DAY` | Día del mes límite para calcular mora | `5` |

## Autenticación

### Modo DEV (`DEV_MODE=true`)
Acepta cualquier Bearer token. Decodifica el payload JWT sin verificar firma y extrae `role` (por defecto `ADMIN`). **Nunca usar en producción.**

Para simular un propietario, genera un JWT con payload: `{ "role": "PROPIETARIO", "uid": "<firebase_uid>" }`.

### Modo producción (`DEV_MODE=false`)
Verifica tokens Firebase RS256 contra las claves públicas de Google. Requiere `FIREBASE_PROJECT_ID` configurado. El campo `role` debe estar en los custom claims del token Firebase.

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | — | Estado del servicio |
| GET/POST/PUT/DELETE | `/api/v1/owners` | ADMIN | CRUD propietarios |
| GET/POST/PUT | `/api/v1/apartments` | ADMIN | CRUD departamentos |
| POST/DELETE | `/api/v1/apartments/{id}/owners/{id}` | ADMIN | Asignar/remover propietario |
| GET/POST | `/api/v1/apartment-fees` | ADMIN | Cuotas por período |
| POST | `/api/v1/apartment-fees/bulk` | ADMIN | Carga masiva de cuotas |
| GET/POST/PUT | `/api/v1/payments` | ADMIN | Pagos (anular vía PUT) |
| GET/POST/PUT | `/api/v1/fines` | ADMIN | Multas (anular vía PUT) |
| GET/POST | `/api/v1/expenses` | ADMIN | Gastos |
| GET | `/api/v1/delinquency` | ADMIN | Lista morosos |
| GET | `/api/v1/delinquency/detail/{owner_id}` | ADMIN | Detalle morosidad por propietario |
| GET | `/api/v1/account-statement` | Autenticado | Estado de cuenta (propietario) |
| GET | `/api/v1/account-statement/export` | Autenticado | Exportar estado de cuenta (CSV) |
| GET | `/api/v1/reports/delinquency` | ADMIN | Reporte morosidad (CSV) |
| GET | `/api/v1/reports/income` | ADMIN | Reporte ingresos (CSV) |
| GET | `/api/v1/reports/balance` | ADMIN | Balance ingresos vs egresos (CSV) |

## Estado de cuenta — Propietarios

Para que un propietario vea su estado de cuenta, su registro en la tabla `owners` debe tener `firebase_uid` igual al UID de Firebase Auth. Actualizar con:

```sql
UPDATE owners SET firebase_uid = 'uid-de-firebase' WHERE document_id = '12345';
```

## TODOs pendientes

- [ ] Implementar verificación real de tokens Firebase en producción
- [ ] Endpoint para actualizar `firebase_uid` de propietarios (vinculación de cuenta)
- [ ] Subida de archivos a S3/MinIO (comprobantes de pago y facturas de gastos)
- [ ] Generación de PDF real con reportlab (actualmente exporta CSV)
- [ ] Migraciones versionadas con Alembic
- [ ] Rate limiting y headers `X-RateLimit-*`
- [ ] Logs estructurados en JSON con correlationId
