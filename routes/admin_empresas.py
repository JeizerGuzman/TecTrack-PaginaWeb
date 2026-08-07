from flask import jsonify, request
from flask_jwt_extended import jwt_required
from config import db
from decorators import rol_requerido
from models import Empresa, Usuario, Vehiculo, Dispositivo, Plan

def registrar_admin_empresas_routes(app):
    @app.get("/api/admin/empresas")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_empresas():
        empresas = Empresa.query.order_by(Empresa.id.desc()).all()
        empresas_json = []
        for empresa in empresas:
            total_usuarios = Usuario.query.filter_by(empresa_id=empresa.id).count()
            total_vehiculos = Vehiculo.query.filter_by(empresa_id=empresa.id).count()
            total_dispositivos = Dispositivo.query.filter_by(empresa_id=empresa.id).count()
            plan = db.session.get(Plan, empresa.plan_id) if empresa.plan_id else None

            empresas_json.append({
                "id": empresa.id, "nombre": empresa.nombre, "correo": empresa.correo,
                "telefono": empresa.telefono, "direccion": empresa.direccion,
                "plan_id": empresa.plan_id, "plan_nombre": plan.nombre if plan else None,
                "activo": empresa.activo, "fecha_creacion": empresa.fecha_creacion,
                "total_usuarios": total_usuarios, "total_vehiculos": total_vehiculos,
                "total_dispositivos": total_dispositivos,
            })
        return jsonify({"ok": True, "empresas": empresas_json}), 200

    @app.post("/api/admin/empresas")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_empresa():
        data = request.get_json(silent=True) or {}
        nombre = data.get("nombre", "").strip()
        correo = data.get("correo", "").strip().lower()
        telefono = data.get("telefono", "").strip()
        direccion = data.get("direccion", "").strip()
        plan_id = data.get("plan_id")

        if not nombre: return jsonify({"error": "El nombre de la empresa es requerido"}), 400
        if correo and Empresa.query.filter_by(correo=correo).first():
            return jsonify({"error": "Ya existe una empresa con ese correo"}), 409
        if plan_id in ("", None): plan_id = None
        if plan_id and not db.session.get(Plan, int(plan_id)):
            return jsonify({"error": "El plan seleccionado no existe"}), 404

        try:
            empresa = Empresa(
                nombre=nombre, correo=correo or None, telefono=telefono or None,
                direccion=direccion or None, plan_id=int(plan_id) if plan_id else None, activo=True
            )
            db.session.add(empresa)
            db.session.commit()
            return jsonify({
                "ok": True, "mensaje": "Empresa creada correctamente",
                "empresa": {
                    "id": empresa.id, "nombre": empresa.nombre, "correo": empresa.correo,
                    "telefono": empresa.telefono, "direccion": empresa.direccion,
                    "plan_id": empresa.plan_id, "activo": empresa.activo, "fecha_creacion": empresa.fecha_creacion,
                }
            }), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo crear la empresa"}), 500

    @app.get("/api/admin/empresas/<int:empresa_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_empresa(empresa_id):
        empresa = db.session.get(Empresa, empresa_id)
        if not empresa: return jsonify({"error": "Empresa no encontrada"}), 404
        return jsonify({
            "ok": True, "empresa": {
                "id": empresa.id, "nombre": empresa.nombre, "correo": empresa.correo,
                "telefono": empresa.telefono, "direccion": empresa.direccion,
                "plan_id": empresa.plan_id, "activo": empresa.activo, "fecha_creacion": empresa.fecha_creacion,
            }
        }), 200

    @app.put("/api/admin/empresas/<int:empresa_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_empresa(empresa_id):
        empresa = db.session.get(Empresa, empresa_id)
        if not empresa: return jsonify({"error": "Empresa no encontrada"}), 404

        data = request.get_json(silent=True) or {}
        nombre = data.get("nombre", "").strip()
        correo = data.get("correo", "").strip().lower()
        telefono = data.get("telefono", "").strip()
        direccion = data.get("direccion", "").strip()
        plan_id = data.get("plan_id")

        if not nombre: return jsonify({"error": "El nombre de la empresa es requerido"}), 400
        if correo and Empresa.query.filter(Empresa.correo == correo, Empresa.id != empresa.id).first():
            return jsonify({"error": "Ya existe otra empresa con ese correo"}), 409
        if plan_id in ("", None): plan_id = None
        if plan_id and not db.session.get(Plan, int(plan_id)):
            return jsonify({"error": "El plan seleccionado no existe"}), 404

        try:
            empresa.nombre = nombre
            empresa.correo = correo or None
            empresa.telefono = telefono or None
            empresa.direccion = direccion or None
            empresa.plan_id = int(plan_id) if plan_id else None
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Empresa actualizada correctamente"}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo actualizar la empresa"}), 500

    @app.put("/api/admin/empresas/<int:empresa_id>/desactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_desactivar_empresa(empresa_id):
        empresa = db.session.get(Empresa, empresa_id)
        if not empresa: return jsonify({"error": "Empresa no encontrada"}), 404
        empresa.activo = False
        db.session.commit()
        return jsonify({"ok": True, "mensaje": "Empresa desactivada correctamente"}), 200

    @app.put("/api/admin/empresas/<int:empresa_id>/reactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_reactivar_empresa(empresa_id):
        empresa = db.session.get(Empresa, empresa_id)
        if not empresa: return jsonify({"error": "Empresa no encontrada"}), 404
        empresa.activo = True
        db.session.commit()
        return jsonify({"ok": True, "mensaje": "Empresa reactivada correctamente"}), 200