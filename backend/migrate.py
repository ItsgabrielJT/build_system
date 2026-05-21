#!/usr/bin/env python3
"""
Migration Runner — Ejecuta todas las migraciones SQL en orden.

Usage:
    python migrate.py              # Ejecuta todas las migraciones pendientes
    python migrate.py --status     # Muestra estado de migraciones ejecutadas
    python migrate.py --reset      # Elimina la tabla de seguimiento (cuidado!)
"""

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración
DATABASE_URL = os.getenv("DATABASE_URL")
MIGRATIONS_DIR = Path(__file__).parent / "migrations"
SCHEMA_VERSION_TABLE = "schema_version"


async def get_connection():
    """Conecta a la base de datos PostgreSQL."""
    if not DATABASE_URL:
        print("❌ ERROR: DATABASE_URL no está configurado en .env")
        sys.exit(1)
    
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        return conn
    except asyncpg.PostgresError as e:
        print(f"❌ ERROR: No se pudo conectar a la base de datos: {e}")
        sys.exit(1)


async def ensure_version_table(conn):
    """Crea la tabla de seguimiento de versiones si no existe."""
    await conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA_VERSION_TABLE} (
            id SERIAL PRIMARY KEY,
            version TEXT UNIQUE NOT NULL,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            execution_time_ms INTEGER
        )
        """
    )


async def get_executed_migrations(conn) -> set[str]:
    """Obtiene el conjunto de migraciones ya ejecutadas."""
    rows = await conn.fetch(f"SELECT version FROM {SCHEMA_VERSION_TABLE} ORDER BY version")
    return {row["version"] for row in rows}


async def run_migration(conn, migration_path: Path) -> int:
    """
    Ejecuta una migración y registra su ejecución.
    
    Returns:
        execution_time_ms: Tiempo de ejecución en milisegundos
    """
    migration_name = migration_path.name
    
    try:
        # Leer contenido del archivo SQL
        sql_content = migration_path.read_text(encoding="utf-8")
        
        if not sql_content.strip():
            print(f"⊘  {migration_name:<40} [VACÍO]")
            return 0
        
        # Ejecutar la migración
        start_time = datetime.now()
        await conn.execute(sql_content)
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Registrar en la tabla de versiones
        await conn.execute(
            f"""
            INSERT INTO {SCHEMA_VERSION_TABLE} (version, execution_time_ms)
            VALUES ($1, $2)
            """,
            migration_name,
            int(execution_time),
        )
        
        print(f"✓  {migration_name:<40} [{execution_time:>6.1f} ms]")
        return int(execution_time)
        
    except Exception as e:
        print(f"✗  {migration_name:<40} [ERROR]")
        print(f"   → {str(e)}")
        raise


async def get_migrations_to_run(conn) -> list[Path]:
    """Obtiene la lista de migraciones pendientes en orden."""
    executed = await get_executed_migrations(conn)
    
    # Obtener todos los archivos .sql en migrations/
    all_migrations = sorted(MIGRATIONS_DIR.glob("*.sql"))
    
    # Filtrar solo las no ejecutadas
    pending = [m for m in all_migrations if m.name not in executed]
    
    return pending


async def show_status(conn):
    """Muestra el estado de todas las migraciones."""
    executed = await get_executed_migrations(conn)
    all_migrations = sorted(MIGRATIONS_DIR.glob("*.sql"))
    
    print("\n📋 Estado de Migraciones:")
    print("─" * 70)
    
    for migration in all_migrations:
        status = "✓ Ejecutada" if migration.name in executed else "⊘ Pendiente"
        print(f"{migration.name:<45} {status}")
    
    print("─" * 70)
    print(f"Total: {len(executed)} ejecutadas, {len(all_migrations) - len(executed)} pendientes\n")


async def reset_migrations(conn):
    """Elimina la tabla de seguimiento de migraciones (CUIDADO!)."""
    confirm = input(
        "⚠️  ¿REALMENTE deseas eliminar el registro de migraciones? "
        "Esto NO elimina los cambios en la BD, solo el seguimiento. (s/n): "
    )
    
    if confirm.lower() != "s":
        print("Operación cancelada.")
        return
    
    await conn.execute(f"DROP TABLE IF EXISTS {SCHEMA_VERSION_TABLE} CASCADE")
    await ensure_version_table(conn)
    print("✓ Tabla de seguimiento reiniciada.\n")


async def main():
    """Punto de entrada principal."""
    conn = await get_connection()
    
    try:
        # Asegurar que existe la tabla de versiones
        await ensure_version_table(conn)
        
        # Procesar argumentos
        if len(sys.argv) > 1:
            if sys.argv[1] == "--status":
                await show_status(conn)
                return
            elif sys.argv[1] == "--reset":
                await reset_migrations(conn)
                return
            else:
                print(f"❌ Argumento desconocido: {sys.argv[1]}")
                print("Uso: python migrate.py [--status|--reset]")
                sys.exit(1)
        
        # Obtener migraciones pendientes
        pending = await get_migrations_to_run(conn)
        
        if not pending:
            print("✓ Base de datos al día. No hay migraciones pendientes.\n")
            await show_status(conn)
            return
        
        # Ejecutar migraciones
        print(f"\n🚀 Ejecutando {len(pending)} migración(es)...\n")
        
        total_time = 0
        for migration_path in pending:
            time_ms = await run_migration(conn, migration_path)
            total_time += time_ms
        
        print(f"\n✅ Migraciones completadas en {total_time} ms")
        await show_status(conn)
        
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
