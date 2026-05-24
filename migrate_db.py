"""
Script de migración para actualizar el esquema de BD.
Funciona tanto en local (MySQL) como en Railway (MySQL via DATABASE_URL).

Uso:
    python migrate_db.py
"""

import os
import pymysql
from urllib.parse import urlparse

def obtener_credenciales():
    """Obtiene credenciales de DATABASE_URL o de config.py como fallback."""

    url = os.getenv('DATABASE_URL')

    if not url:
        # Fallback: leer config.py para desarrollo local
        from config import Config
        url = Config.SQLALCHEMY_DATABASE_URI

    # Limpiar prefijos que SQLAlchemy agrega
    url = url.replace('mysql+pymysql://', 'mysql://')

    parsed = urlparse(url)

    return {
        "host":     parsed.hostname,
        "user":     parsed.username,
        "password": parsed.password,
        "database": parsed.path.lstrip('/'),
        "port":     parsed.port or 3306
    }

def ejecutar_migracion():
    creds = obtener_credenciales()
    print(f"[Migración] Conectando a {creds['user']}@{creds['host']}:{creds['port']}/{creds['database']}")

    try:
        conn = pymysql.connect(
            host=creds['host'],
            user=creds['user'],
            password=creds['password'],
            database=creds['database'],
            port=creds['port']
        )
        cursor = conn.cursor()

        # ── MIGRACIÓN 1: identificador en vehiculos ──────────────
        print("\n[1] Verificando columna 'identificador' en 'vehiculos'...")
        cursor.execute("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME='vehiculos' AND COLUMN_NAME='identificador'
        """)
        if not cursor.fetchone():
            cursor.execute("""
                ALTER TABLE vehiculos
                ADD COLUMN identificador VARCHAR(50) UNIQUE AFTER nombre
            """)
            conn.commit()
            print("  ✓ Columna 'identificador' agregada")
        else:
            print("  ✓ Ya existe")

        # ── MIGRACIÓN 2: id_vehiculo en historial ────────────────
        print("\n[2] Verificando columna 'id_vehiculo' en 'historial'...")
        cursor.execute("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME='historial' AND COLUMN_NAME='id_vehiculo'
        """)
        if not cursor.fetchone():
            cursor.execute("""
                ALTER TABLE historial
                ADD COLUMN id_vehiculo INT AFTER vehiculo
            """)
            conn.commit()
            print("  ✓ Columna 'id_vehiculo' agregada")
        else:
            print("  ✓ Ya existe")

        # ── MIGRACIÓN 3: chofer_id en vehiculos ──────────────────
        print("\n[3] Verificando columna 'chofer_id' en 'vehiculos'...")
        cursor.execute("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME='vehiculos' AND COLUMN_NAME='chofer_id'
        """)
        if not cursor.fetchone():
            cursor.execute("""
                ALTER TABLE vehiculos
                ADD COLUMN chofer_id INT AFTER usuario_id
            """)
            conn.commit()
            print("  ✓ Columna 'chofer_id' agregada")
        else:
            print("  ✓ Ya existe")
            
        # ── MIGRACIÓN 4: tabla push_subscripciones ───────────────
        print("\n[4] Verificando tabla 'push_subscripciones'...")
        cursor.execute("""
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'push_subscripciones'
        """)
        if not cursor.fetchone():
            cursor.execute("""
                CREATE TABLE push_subscripciones (
                    id         INT AUTO_INCREMENT PRIMARY KEY,
                    usuario_id INT NOT NULL,
                    endpoint   TEXT NOT NULL,
                    p256dh     TEXT NOT NULL,
                    auth       TEXT NOT NULL,
                    created_at INT,
                    CONSTRAINT uq_endpoint UNIQUE (endpoint(500)),
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
                )
            """)
            conn.commit()
            print("  ✓ Tabla 'push_subscripciones' creada")
        else:
            print("  ✓ Ya existe")
            
            
        print("\n[✓] Migración completada exitosamente")
        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"\n[✗] Error en migración: {e}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print(" TrackSecurity - Script de Migración de BD")
    print("=" * 60)

    if ejecutar_migracion():
        print("\n[OK] BD actualizada. Puedes ejecutar la app normalmente.")
    else:
        print("\n[Error] Revisa la conexión y las variables de entorno.")
        exit(1)