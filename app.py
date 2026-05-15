from flask import Flask, request, jsonify, render_template, session, redirect
from flask_cors import CORS
import time
import bcrypt
import re

from config import db, Config
from models import Usuario, Vehiculo, Historial

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config.from_object(Config)

db.init_app(app)
CORS(app)

with app.app_context():
    db.create_all()

# ================= FUNCIONES DE VALIDACIÓN =================
def validar_email(correo):
    patron = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(patron, correo) is not None

def validar_password(password):
    if len(password) < 6:
        return False, "La contraseña debe tener al menos 6 caracteres"
    if not re.search(r'\d', password):
        return False, "La contraseña debe contener al menos 1 número"
    if not re.search(r'[a-zA-Z]', password):
        return False, "La contraseña debe contener al menos 1 letra"
    return True, "Válida"

def validar_tipo(tipo):
    return tipo in ["dueno", "chofer"]

def _nombre_chofer(vehiculo_obj):
    if not vehiculo_obj.chofer_id:
        return None
    chofer = Usuario.query.get(vehiculo_obj.chofer_id)
    return chofer.nombre if chofer else None

# ================= API LISTAR CHOFERES =================
@app.route('/api/choferes', methods=['GET'])
def listar_choferes():
    if 'id' not in session:
        return jsonify({"error": "no autenticado"}), 401
    if session.get('tipo') != 'dueno':
        return jsonify({"error": "acceso denegado"}), 403
    choferes = Usuario.query.filter_by(tipo='chofer').all()
    return jsonify({
        "choferes": [{"id": c.id, "nombre": c.nombre, "correo": c.correo} for c in choferes]
    }), 200

# ================= API HISTORIAL COMPRIMIDO =================
@app.route('/api/historial/<int:vehiculo_id>', methods=['GET'])
def obtener_historial(vehiculo_id):
    if 'id' not in session:
        return jsonify({"error": "no autenticado"}), 401

    usuario_id   = session['id']
    tipo_usuario = session.get('tipo')

    if tipo_usuario == 'dueno':
        vehiculo = Vehiculo.query.filter_by(id=vehiculo_id, usuario_id=usuario_id).first()
    elif tipo_usuario == 'chofer':
        vehiculo = Vehiculo.query.filter_by(id=vehiculo_id, chofer_id=usuario_id).first()
    else:
        return jsonify({"error": "acceso denegado"}), 403

    if not vehiculo:
        return jsonify({"error": "vehículo no encontrado"}), 404

    registros = Historial.query.filter_by(id_vehiculo=vehiculo_id)\
        .order_by(Historial.timestamp.asc()).all()

    if not registros:
        return jsonify({"rangos": [], "vehiculo": vehiculo.nombre}), 200

    rangos = []
    actual = {
        "estado":    registros[0].estado,
        "puerta":    registros[0].puerta,
        "vibracion": registros[0].vibracion,
        "alerta":    registros[0].alerta,
        "inicio":    registros[0].timestamp,
        "fin":       registros[0].timestamp,
    }

    for r in registros[1:]:
        mismo = (
            r.estado    == actual["estado"]    and
            r.puerta    == actual["puerta"]    and
            r.vibracion == actual["vibracion"] and
            r.alerta    == actual["alerta"]
        )
        if mismo:
            actual["fin"] = r.timestamp
        else:
            rangos.append(actual)
            actual = {
                "estado":    r.estado,
                "puerta":    r.puerta,
                "vibracion": r.vibracion,
                "alerta":    r.alerta,
                "inicio":    r.timestamp,
                "fin":       r.timestamp,
            }

    rangos.append(actual)
    rangos.reverse()
    return jsonify({"vehiculo": vehiculo.nombre, "rangos": rangos}), 200

# ================= API MAPA / RUTA GPS =================
@app.route('/api/mapa/<int:vehiculo_id>', methods=['GET'])
def obtener_mapa(vehiculo_id):
    """Devuelve puntos GPS para dibujar la ruta del vehículo."""
    if 'id' not in session:
        return jsonify({"error": "no autenticado"}), 401

    usuario_id   = session['id']
    tipo_usuario = session.get('tipo')

    if tipo_usuario == 'dueno':
        vehiculo = Vehiculo.query.filter_by(id=vehiculo_id, usuario_id=usuario_id).first()
    elif tipo_usuario == 'chofer':
        vehiculo = Vehiculo.query.filter_by(id=vehiculo_id, chofer_id=usuario_id).first()
    else:
        return jsonify({"error": "acceso denegado"}), 403

    if not vehiculo:
        return jsonify({"error": "vehículo no encontrado"}), 404

    # Solo registros con GPS válido, últimas 24h
    tiempo_limite = int(time.time()) - (24 * 60 * 60)
    registros = Historial.query.filter(
        Historial.id_vehiculo == vehiculo_id,
        Historial.lat.isnot(None),
        Historial.lng.isnot(None),
        Historial.timestamp >= tiempo_limite
    ).order_by(Historial.timestamp.asc()).all()

    # Reducir a máximo 200 puntos para no saturar el mapa
    MAX_PUNTOS = 200
    if len(registros) > MAX_PUNTOS:
        paso      = len(registros) // MAX_PUNTOS
        registros = registros[::paso]

    puntos = [
        {
            "lat":       r.lat,
            "lng":       r.lng,
            "timestamp": r.timestamp,
            "alerta":    r.alerta,
            "estado":    r.estado,
        }
        for r in registros
    ]

    ultima = puntos[-1] if puntos else None

    return jsonify({
        "vehiculo": vehiculo.nombre,
        "puntos":   puntos,
        "ultima":   ultima,
        "total":    len(puntos)
    }), 200

# ================= RUTAS HTML =================
@app.route('/')
def index():
    if 'usuario' in session:
        return redirect('/panel')
    return render_template('login.html')

@app.route('/registro')
def vista_registro():
    return render_template('registro.html')

@app.route('/panel')
def vista_panel():
    if 'usuario' not in session:
        return redirect('/')
    return render_template('index.html', tipo=session['tipo'], nombre=session['usuario'], id_usuario=session['id'])

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

# ================= API REGISTRO =================
@app.route('/api/registro', methods=['POST'])
def api_registro():
    data = request.json
    if not data or not all(k in data for k in ["nombre", "correo", "password", "tipo"]):
        return jsonify({"error": "campos incompletos"}), 400

    nombre   = data.get("nombre", "").strip()
    correo   = data.get("correo", "").strip()
    password = data.get("password", "")
    tipo     = data.get("tipo", "").strip()

    if not nombre or not correo or not password or not tipo:
        return jsonify({"error": "todos los campos son requeridos"}), 400
    if not validar_email(correo):
        return jsonify({"error": "correo inválido"}), 400
    if not validar_tipo(tipo):
        return jsonify({"error": "tipo de usuario inválido"}), 400

    valido, mensaje = validar_password(password)
    if not valido:
        return jsonify({"error": mensaje}), 400

    existente = Usuario.query.filter_by(correo=correo).first()
    if existente:
        return jsonify({"error": "correo ya registrado"}), 400

    try:
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        usuario = Usuario(nombre=nombre, correo=correo, password=password_hash, tipo=tipo)
        db.session.add(usuario)
        db.session.commit()
        return jsonify({"ok": True, "mensaje": "cuenta creada exitosamente"}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error al registrar: {e}")
        return jsonify({"error": "error interno del servidor"}), 500

# ================= API LOGIN =================
@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    if not data or not all(k in data for k in ["correo", "password"]):
        return jsonify({"error": "correo y contraseña requeridos"}), 400

    correo   = data.get("correo", "").strip()
    password = data.get("password", "")

    if not correo or not password:
        return jsonify({"error": "correo y contraseña requeridos"}), 400

    usuario = Usuario.query.filter_by(correo=correo).first()
    if not usuario:
        return jsonify({"error": "correo o contraseña incorrectos"}), 401
    if not bcrypt.checkpw(password.encode(), usuario.password.encode()):
        return jsonify({"error": "correo o contraseña incorrectos"}), 401

    session['usuario'] = usuario.nombre
    session['tipo']    = usuario.tipo
    session['id']      = usuario.id

    return jsonify({"ok": True, "id": usuario.id, "nombre": usuario.nombre, "tipo": usuario.tipo}), 200

# ================= API CREAR VEHÍCULO =================
@app.route('/api/vehiculos', methods=['POST'])
def crear_vehiculo():
    if 'id' not in session:
        return jsonify({"error": "no autenticado"}), 401
    if session.get('tipo') != 'dueno':
        return jsonify({"error": "solo los dueños pueden agregar vehículos"}), 403

    data = request.json
    if not data or "nombre" not in data or "identificador" not in data:
        return jsonify({"error": "nombre e identificador requeridos"}), 400

    nombre        = data.get("nombre", "").strip()
    identificador = data.get("identificador", "").strip()

    if not nombre or not identificador:
        return jsonify({"error": "nombre e identificador no pueden estar vacíos"}), 400

    existente = Vehiculo.query.filter_by(identificador=identificador).first()
    if existente:
        return jsonify({"error": "identificador ya existe"}), 400

    try:
        vehiculo = Vehiculo(nombre=nombre, identificador=identificador, usuario_id=session['id'])
        db.session.add(vehiculo)
        db.session.commit()
        return jsonify({"ok": True, "vehiculo_id": vehiculo.id, "nombre": vehiculo.nombre, "identificador": vehiculo.identificador}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error al crear vehículo: {e}")
        return jsonify({"error": "error interno del servidor"}), 500

# ================= API ASIGNAR CHOFER =================
@app.route('/api/vehiculos/<int:vehiculo_id>/asignar', methods=['POST'])
def asignar_chofer(vehiculo_id):
    if 'id' not in session:
        return jsonify({"error": "no autenticado"}), 401
    if session.get('tipo') != 'dueno':
        return jsonify({"error": "solo los dueños pueden asignar choferes"}), 403

    data = request.json
    if not data or "chofer_id" not in data:
        return jsonify({"error": "chofer_id requerido"}), 400

    chofer_id = data.get("chofer_id")

    try:
        vehiculo = Vehiculo.query.filter_by(id=vehiculo_id, usuario_id=session['id']).first()
        if not vehiculo:
            return jsonify({"error": "vehículo no encontrado"}), 404

        if chofer_id is None:
            vehiculo.chofer_id = None
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "chofer desasignado"}), 200

        chofer = Usuario.query.filter_by(id=chofer_id, tipo='chofer').first()
        if not chofer:
            return jsonify({"error": "chofer no existe"}), 404

        vehiculo.chofer_id = chofer_id
        db.session.commit()
        return jsonify({"ok": True, "chofer_id": chofer_id, "chofer_nombre": chofer.nombre}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al asignar chofer: {e}")
        return jsonify({"error": "error interno del servidor"}), 500

# ================= API ELIMINAR VEHÍCULO =================
@app.route('/api/vehiculos/<int:vehiculo_id>', methods=['DELETE'])
def eliminar_vehiculo(vehiculo_id):
    if 'id' not in session:
        return jsonify({"error": "no autenticado"}), 401
    if session.get('tipo') != 'dueno':
        return jsonify({"error": "solo los dueños pueden eliminar vehículos"}), 403

    try:
        vehiculo = Vehiculo.query.filter_by(id=vehiculo_id, usuario_id=session['id']).first()
        if not vehiculo:
            return jsonify({"error": "vehículo no encontrado"}), 404

        Historial.query.filter_by(id_vehiculo=vehiculo_id).delete()
        db.session.delete(vehiculo)
        db.session.commit()
        return jsonify({"ok": True}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar vehículo: {e}")
        return jsonify({"error": "error interno del servidor"}), 500

# ================= RECIBIR DATOS ESP32 =================
@app.route('/datos', methods=['POST'])
def recibir_datos():
    data = request.json
    if not data or "vehiculo" not in data:
        return jsonify({"error": "sin vehiculo"}), 400

    try:
        identificador_esp32 = data["vehiculo"]
        vehiculo_obj        = Vehiculo.query.filter_by(identificador=identificador_esp32).first()
        id_vehiculo         = vehiculo_obj.id if vehiculo_obj else None

        if Historial.query.count() > 100:
            tiempo_limite        = int(time.time()) - (24 * 60 * 60)
            registros_eliminados = Historial.query.filter(Historial.timestamp < tiempo_limite).delete()
            if registros_eliminados > 0:
                db.session.commit()
            else:
                db.session.rollback()

        # ── GPS: leer coordenadas si vienen (campo opcional) ─────
        lat = data.get("lat", None)
        lng = data.get("lng", None)
        if lat is not None and lng is not None:
            try:
                lat = float(lat)
                lng = float(lng)
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    lat = lng = None
            except (ValueError, TypeError):
                lat = lng = None

        registro = Historial(
            vehiculo    = data["vehiculo"],
            id_vehiculo = id_vehiculo,
            estado      = data["estado"],
            alerta      = data["alerta"],
            puerta      = data["puerta"],
            vibracion   = data["vibracion"],
            timestamp   = int(time.time()),
            lat         = lat,
            lng         = lng,
        )
        db.session.add(registro)
        db.session.commit()
        return jsonify({"ok": True})

    except Exception as e:
        db.session.rollback()
        print(f"Error al guardar datos: {e}")
        return jsonify({"error": "Error interno del servidor"}), 500

# ================= OBTENER ESTADO =================
@app.route('/estado', methods=['GET'])
def obtener_estado():
    if 'id' not in session:
        return jsonify({"error": "no autenticado"}), 401

    usuario_id   = session['id']
    tipo_usuario = session.get('tipo', 'usuario')

    if tipo_usuario == 'dueno':
        vehiculos_usuario = Vehiculo.query.filter_by(usuario_id=usuario_id).all()
    elif tipo_usuario == 'chofer':
        vehiculos_usuario = Vehiculo.query.filter_by(chofer_id=usuario_id).all()
    else:
        return jsonify({"error": "tipo de usuario inválido"}), 400

    if not vehiculos_usuario:
        return jsonify({}), 200

    vehiculo_ids  = [v.id for v in vehiculos_usuario]
    registros     = Historial.query.filter(
        Historial.id_vehiculo.in_(vehiculo_ids)
    ).order_by(Historial.id.desc()).limit(app.config['MAX_RECORDS_LIMIT']).all()

    resultado     = {}
    TIEMPO_LIMITE = 8
    tiempo_actual = int(time.time())

    for v in vehiculos_usuario:
        resultado[v.nombre] = {
            "vehiculo":      v.nombre,
            "vehiculo_id":   v.id,
            "chofer_nombre": _nombre_chofer(v),
            "estado":        "sin señal",
            "alerta":        0,
            "puerta":        "desconocida",
            "vibracion":     0,
            "timestamp":     None,
            "lat":           None,
            "lng":           None,
        }

    for r in registros:
        vehiculo_obj = next((v for v in vehiculos_usuario if v.id == r.id_vehiculo), None)
        if vehiculo_obj:
            nombre_vehiculo = vehiculo_obj.nombre
            if nombre_vehiculo in resultado and resultado[nombre_vehiculo]["timestamp"] is None:
                if tiempo_actual - r.timestamp > TIEMPO_LIMITE:
                    resultado[nombre_vehiculo].update({
                        "estado":    "sin señal",
                        "alerta":    0,
                        "puerta":    "desconocida",
                        "vibracion": 0,
                        "timestamp": r.timestamp,
                        "lat":       r.lat,
                        "lng":       r.lng,
                    })
                else:
                    resultado[nombre_vehiculo].update({
                        "estado":    r.estado,
                        "alerta":    r.alerta,
                        "puerta":    r.puerta,
                        "vibracion": r.vibracion,
                        "timestamp": r.timestamp,
                        "lat":       r.lat,
                        "lng":       r.lng,
                    })

    return jsonify(resultado), 200

# ================= MAIN =================
if __name__ == '__main__':
    import os
    port  = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV', 'production') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)