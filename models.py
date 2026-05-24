from config import db

# ================= USUARIOS =================
class Usuario(db.Model):
    __tablename__ = 'usuarios'

    id       = db.Column(db.Integer, primary_key=True)
    nombre   = db.Column(db.String(50))
    correo   = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(100))
    tipo     = db.Column(db.String(20))  # dueno / chofer

# ================= VEHICULOS =================
class Vehiculo(db.Model):
    __tablename__ = 'vehiculos'

    id            = db.Column(db.Integer, primary_key=True)
    nombre        = db.Column(db.String(50))
    identificador = db.Column(db.String(50), unique=True)
    usuario_id    = db.Column(db.Integer, db.ForeignKey('usuarios.id'))
    chofer_id     = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)

# ================= HISTORIAL =================
class Historial(db.Model):
    __tablename__ = 'historial'

    id          = db.Column(db.Integer, primary_key=True)
    vehiculo    = db.Column(db.String(50))
    id_vehiculo = db.Column(db.Integer, db.ForeignKey('vehiculos.id'))
    estado      = db.Column(db.String(20))
    alerta      = db.Column(db.Integer)
    puerta      = db.Column(db.String(20))
    vibracion   = db.Column(db.Integer)
    timestamp   = db.Column(db.Integer)
    # ── GPS ──────────────────────────────────────────────────────
    lat         = db.Column(db.Float, nullable=True)  # latitud
    lng         = db.Column(db.Float, nullable=True)  # longitud
    
# ================= PUSH SUBSCRIPCIONES =================
class PushSubscripcion(db.Model):
    """Guarda las suscripciones Web Push de cada usuario."""
    __tablename__ = 'push_subscripciones'

    id         = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    endpoint   = db.Column(db.Text, nullable=False, unique=True)
    p256dh     = db.Column(db.Text, nullable=False)
    auth       = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.Integer, default=lambda: int(__import__('time').time()))