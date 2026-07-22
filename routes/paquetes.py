from flask import jsonify

from models import Plan

from serializers import serializar_plan_publico


def registrar_paquetes_routes(app):

    @app.get("/api/publico/planes")
    def api_publico_planes():

        planes = (
            Plan.query
            .filter_by(activo=True)
            .order_by(Plan.id.asc())
            .all()
        )

        return jsonify([
            serializar_plan_publico(plan)
            for plan in planes
        ])