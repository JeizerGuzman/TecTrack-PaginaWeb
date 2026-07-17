import os
from pathlib import Path
from datetime import timedelta

from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy

# Carga variables del archivo .env cuando trabajas en local
load_dotenv()

# Instancia global de SQLAlchemy
db = SQLAlchemy()


class Config:
    """
    Configuración general de TrackSecurity.

    Prioridad de conexión a base de datos:
    1. DATABASE_URL: Railway / producción.
    2. LOCAL_DATABASE_URL: entorno local.
    3. Valor local por defecto.
    """

    # =========================
    # ENTORNO
    # =========================
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = FLASK_ENV == "development"

    # =========================
    # SEGURIDAD
    # =========================
    SECRET_KEY = os.getenv("SECRET_KEY", "TrackSecurity2026")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "TrackSecurityJWT2026")
    
    # Tiempo que dura la sesion abierta antes de que caduque el token
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=1)
    # JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    
    # =========================
    # BASE DE DATOS
    # =========================
    _db_url = os.getenv("DATABASE_URL")

    if not _db_url:
        _db_url = os.getenv(
            "LOCAL_DATABASE_URL",
            "mysql+pymysql://root@localhost:3306/tracksecurity"
        )

    # Railway suele entregar mysql:// y SQLAlchemy necesita mysql+pymysql://
    if _db_url.startswith("mysql://"):
        _db_url = _db_url.replace("mysql://", "mysql+pymysql://", 1)

    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # =========================
    # LIMITES DEL SISTEMA
    # =========================
    MAX_RECORDS_LIMIT = int(os.getenv("MAX_RECORDS_LIMIT", 50))

    # =========================
    # EVIDENCIAS / IMÁGENES
    # =========================
    BASE_DIR = Path(__file__).resolve().parent

    UPLOAD_FOLDER = os.getenv(
        "UPLOAD_FOLDER",
        str(BASE_DIR / "static" / "uploads" / "evidencias")
    )

    MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # 8 MB por imagen

    # =========================
    # WEB PUSH / NOTIFICACIONES
    # =========================
    VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
    VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
    VAPID_EMAIL = os.getenv("VAPID_EMAIL", "mailto:admin@tracksecurity.com")

    # =========================
    # CORS
    # =========================
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")