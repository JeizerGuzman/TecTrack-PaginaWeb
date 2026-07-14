# ============================================================
# MIGRACIÓN
# segundos_separacion_alertas
# TrackSecurity
# ============================================================
#
# Este script:
# - Comprueba si la tabla configuracion_sistema existe.
# - Comprueba si la columna ya existe.
# - Agrega la columna únicamente cuando hace falta.
# - Conserva todos los datos existentes.
# - Puede ejecutarse varias veces.
# ============================================================

from flask import Flask
from sqlalchemy import inspect, text

from config import db, Config


app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)


with app.app_context():

    print("")
    print("=" * 60)
    print("TrackSecurity")
    print("Migración: segundos_separacion_alertas")
    print("=" * 60)
    print("")

    try:

        inspector = inspect(db.engine)

        tablas = inspector.get_table_names()


        # ====================================================
        # VALIDAR TABLA
        # ====================================================

        if "configuracion_sistema" not in tablas:

            raise RuntimeError(
                "La tabla 'configuracion_sistema' no existe."
            )


        columnas = {
            columna["name"]
            for columna in inspector.get_columns(
                "configuracion_sistema"
            )
        }


        # ====================================================
        # CREAR COLUMNA
        # ====================================================

        if "segundos_separacion_alertas" not in columnas:

            print(
                "Agregando columna "
                "'segundos_separacion_alertas'..."
            )

            db.session.execute(
                text(
                    """
                    ALTER TABLE configuracion_sistema
                    ADD COLUMN segundos_separacion_alertas INT
                    NOT NULL DEFAULT 10
                    """
                )
            )

            db.session.commit()

            print(
                "Columna creada correctamente."
            )

        else:

            print(
                "La columna "
                "'segundos_separacion_alertas' "
                "ya existe."
            )


        # ====================================================
        # ASEGURAR VALOR VÁLIDO EN CONFIGURACIÓN GLOBAL
        # ====================================================

        db.session.execute(
            text(
                """
                UPDATE configuracion_sistema
                SET segundos_separacion_alertas = 10
                WHERE segundos_separacion_alertas IS NULL
                   OR segundos_separacion_alertas < 1
                """
            )
        )

        db.session.commit()


        print("")
        print(
            "Migración finalizada correctamente."
        )
        print("")


    except Exception as error:

        db.session.rollback()

        print("")
        print(
            "ERROR durante la migración:"
        )
        print(error)
        print("")

        raise