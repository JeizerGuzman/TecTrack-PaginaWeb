import bcrypt
from app import app, db, Usuario

CORREO = "admin@gmail.com"
NUEVA_PASSWORD = "admin123"

with app.app_context():
    usuario = Usuario.query.filter_by(correo=CORREO).first()

    if not usuario:
        print("No existe el usuario")
    else:
        usuario.password = bcrypt.hashpw(
            NUEVA_PASSWORD.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        db.session.commit()
        print("Contraseña actualizada:", CORREO, NUEVA_PASSWORD)