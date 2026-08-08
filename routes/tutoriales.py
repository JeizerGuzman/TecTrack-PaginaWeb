# ============================================================
# ROUTES TUTORIALES - TrackSecurity
# ============================================================
#
# Endpoints para consultar y completar recorridos guiados.
# Se reutilizan para dueño y supervisor con el mismo modelo de BD.
# ============================================================

from flask import jsonify
from flask_jwt_extended import jwt_required

from config import db
from decorators import rol_requerido
from helpers import obtener_usuario_actual, timestamp_actual
from models import TutorialProgreso


TUTORIALES_VALIDOS = {
    "dashboard",
    "alertas",
    "configuracion",
    "historial",
    "recorridos",
    "reportes",
    "usuarios",
    "vehiculos",
    "supervisor_dashboard",
    "supervisor_monitoreo",
    "supervisor_vehiculos",
    "supervisor_alertas",
    "supervisor_historial",
    "supervisor_recorridos",
    "supervisor_reportes",
}


def normalizar_clave_tutorial(tutorial_clave):
    clave = str(tutorial_clave or "").strip().lower()
    return clave if clave in TUTORIALES_VALIDOS else None


def serializar_progreso_tutorial(progreso, tutorial_clave):
    return {
        "clave": tutorial_clave,
        "completado": bool(progreso.completado) if progreso else False,
        "fecha_finalizacion": progreso.fecha_finalizacion if progreso else None,
    }


def registrar_rutas_tutoriales(app, prefijo_url, roles_permitidos, endpoint_prefix):

    @jwt_required()
    @rol_requerido(*roles_permitidos)
    def obtener_estado_tutorial(tutorial_clave):
        usuario = obtener_usuario_actual()
        clave = normalizar_clave_tutorial(tutorial_clave)

        if not usuario:
            return jsonify({"error": "usuario no válido"}), 401

        if not clave:
            return jsonify({"error": "tutorial no encontrado"}), 404

        progreso = TutorialProgreso.query.filter_by(
            usuario_id=usuario.id,
            tutorial_clave=clave
        ).first()

        return jsonify({
            "ok": True,
            "tutorial": serializar_progreso_tutorial(progreso, clave)
        }), 200

    @jwt_required()
    @rol_requerido(*roles_permitidos)
    def completar_tutorial(tutorial_clave):
        usuario = obtener_usuario_actual()
        clave = normalizar_clave_tutorial(tutorial_clave)

        if not usuario:
            return jsonify({"error": "usuario no válido"}), 401

        if not clave:
            return jsonify({"error": "tutorial no encontrado"}), 404

        progreso = TutorialProgreso.query.filter_by(
            usuario_id=usuario.id,
            tutorial_clave=clave
        ).first()

        if progreso and progreso.completado:
            return jsonify({
                "ok": True,
                "mensaje": "el tutorial ya estaba completado",
                "tutorial": serializar_progreso_tutorial(progreso, clave)
            }), 200

        try:
            if not progreso:
                progreso = TutorialProgreso(
                    usuario_id=usuario.id,
                    tutorial_clave=clave,
                    completado=True,
                    fecha_finalizacion=timestamp_actual()
                )
                db.session.add(progreso)
            else:
                progreso.completado = True
                if not progreso.fecha_finalizacion:
                    progreso.fecha_finalizacion = timestamp_actual()

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "tutorial marcado como completado",
                "tutorial": serializar_progreso_tutorial(progreso, clave)
            }), 200

        except Exception as error:
            db.session.rollback()
            return jsonify({"error": str(error)}), 500

    app.add_url_rule(
        f"{prefijo_url}/<string:tutorial_clave>/estado",
        endpoint=f"{endpoint_prefix}_tutorial_estado",
        view_func=obtener_estado_tutorial,
        methods=["GET"],
    )

    app.add_url_rule(
        f"{prefijo_url}/<string:tutorial_clave>/completar",
        endpoint=f"{endpoint_prefix}_tutorial_completar",
        view_func=completar_tutorial,
        methods=["POST"],
    )


def registrar_tutoriales_routes(app):
    registrar_rutas_tutoriales(
        app,
        "/api/dueno/tutoriales",
        ("dueno", "admin"),
        "dueno"
    )

    registrar_rutas_tutoriales(
        app,
        "/api/supervisor/tutoriales",
        ("supervisor", "admin"),
        "supervisor"
    )
