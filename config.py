import os
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Config:
    _db_url = os.getenv(
        'DATABASE_URL',
        'mysql+pymysql://root:davidlaid@localhost:3306/monitoreo'
    )

    # Solo reemplaza si viene sin el driver correcto (caso Railway)
    if _db_url.startswith('mysql://'):
        _db_url = _db_url.replace('mysql://', 'mysql+pymysql://', 1)

    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv('SECRET_KEY', 'innovatecsecurity2026')
    MAX_RECORDS_LIMIT = 50