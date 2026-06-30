# TrackSecurity

TrackSecurity es un sistema IoT para monitoreo y seguridad de vehículos de carga. El proyecto permite visualizar vehículos en tiempo real, recibir alertas críticas, administrar choferes, consultar historial GPS y gestionar información operativa desde un dashboard web.

El sistema está pensado para empresas de transporte que necesitan conocer el estado de sus unidades, detectar eventos de riesgo y responder rápidamente ante situaciones como apertura de puertas, vibración sospechosa, pérdida de señal o botón de pánico.

---

## Objetivo del proyecto

Desarrollar una plataforma de monitoreo vehicular que combine hardware IoT, backend web y dashboard administrativo para mejorar la seguridad de unidades de transporte.

El sistema permite:

* Registrar vehículos.
* Asignar choferes.
* Recibir datos desde un ESP32.
* Consultar ubicación GPS.
* Detectar alertas.
* Atender incidentes.
* Consultar historial.
* Administrar usuarios.
* Configurar datos de la empresa.
* Vincular dispositivos físicos.

---

## Tecnologías utilizadas

### Backend

* Python
* Flask
* Flask-JWT-Extended
* Flask-CORS
* Flask-SQLAlchemy
* MySQL
* PyMySQL
* Werkzeug Security
* bcrypt
* python-dotenv

### Frontend

* HTML
* CSS
* JavaScript
* Templates con Jinja2
* Dashboard web responsive

### Hardware / IoT

* ESP32
* SIM7600G-H para GPS/LTE
* Sensores de puerta
* Sensor de vibración
* Botón de pánico
* Sirena o bocina
* LEDs de estado
* FPGA Tang Nano 9K como módulo de apoyo para eventos críticos

---

## Estructura general del proyecto

```text
TrackSecurity/
│
├── app.py
├── config.py
├── models.py
├── helpers.py
├── serializers.py
├── decorators.py
├── requirements.txt
├── README.md
│
├── routes/
│   ├── __init__.py
│   ├── frontend.py
│   ├── auth.py
│   ├── dashboard.py
│   ├── esp32.py
│   ├── vehiculos.py
│   ├── alertas.py
│   ├── historial.py
│   ├── dispositivos.py
│   ├── usuarios.py
│   ├── configuracion.py
│   ├── planes.py
│   └── push.py
│
├── templates/
│   ├── auth/
│   ├── base/
│   └── dueno/
│
├── static/
│   ├── css/
│   ├── js/
│   ├── img/
│   └── uploads/
│
└── .venv/
```

---

## Descripción de archivos principales

### `app.py`

Archivo principal del backend. Se encarga de:

* Crear la aplicación Flask.
* Cargar configuración.
* Inicializar la base de datos.
* Activar CORS.
* Configurar JWT.
* Registrar las rutas del sistema.
* Crear tablas.
* Crear datos iniciales.
* Ejecutar el servidor.

Este archivo debe mantenerse lo más limpio posible. La lógica del sistema se encuentra separada en `routes/`, `helpers.py`, `serializers.py` y `decorators.py`.

---

### `config.py`

Archivo de configuración general.

Contiene:

* Configuración de entorno.
* Claves secretas.
* URL de conexión a MySQL.
* Configuración de SQLAlchemy.
* Configuración de carpetas de subida.
* Variables para notificaciones push.
* Configuración de CORS.

También contiene la instancia global:

```python
db = SQLAlchemy()
```

---

### `models.py`

Contiene los modelos de base de datos usados por SQLAlchemy.

Tablas principales:

* `Plan`
* `Empresa`
* `Usuario`
* `Dispositivo`
* `Vehiculo`
* `Suscripcion`
* `Servicio`
* `UbicacionActual`
* `HistorialGPS`
* `Evento`
* `Alerta`
* `Evidencia`
* `PushSubscripcion`

También contiene la función:

```python
crear_datos_iniciales()
```

Esta función crea datos básicos para pruebas, como planes, empresa demo, usuario dueño y usuario técnico.

---

### `helpers.py`

Contiene funciones auxiliares reutilizables.

Ejemplos:

* Obtener timestamp actual.
* Obtener usuario autenticado.
* Registrar eventos.
* Crear alertas.
* Validar límite de vehículos.
* Revisar si un chofer ya está ocupado.
* Actualizar ubicación actual.
* Guardar historial GPS.
* Procesar datos recibidos del ESP32.

Este archivo no debe tener rutas ni endpoints.

---

### `serializers.py`

Convierte objetos de la base de datos en JSON.

Ejemplos:

* `serializar_vehiculo()`
* `serializar_usuario()`
* `serializar_alerta()`
* `serializar_evento()`

Se usa para enviar datos limpios al frontend y a la app móvil.

---

### `decorators.py`

Contiene decoradores de seguridad.

Principalmente:

```python
rol_requerido()
```

Este decorador permite limitar rutas según el tipo de usuario.

Ejemplo:

```python
@jwt_required()
@rol_requerido("dueno", "admin")
```

---

## Carpeta `routes/`

La carpeta `routes/` contiene las rutas del backend separadas por módulo.

### `routes/__init__.py`

Registra todas las rutas del sistema.

Cada vez que se crea un nuevo archivo de rutas, debe registrarse aquí.

---

### `routes/frontend.py`

Contiene las rutas que renderizan páginas HTML.

Ejemplos:

* `/login`
* `/dueno/dashboard`
* `/dueno/vehiculos`
* `/dueno/alertas`
* `/dueno/usuarios`
* `/dueno/configuracion`

Estas rutas no devuelven datos JSON. Solo muestran templates.

---

### `routes/auth.py`

Contiene rutas de autenticación.

Endpoint principal:

```text
POST /api/login
```

Se usa para iniciar sesión y generar un token JWT.

---

### `routes/dashboard.py`

Contiene endpoints usados por el dashboard principal.

Endpoint principal:

```text
GET /api/estado
```

Devuelve vehículos visibles según el rol del usuario.

---

### `routes/esp32.py`

Contiene el endpoint que recibe datos del ESP32.

Endpoint principal:

```text
POST /datos
```

Este endpoint recibe información como:

* Serie del dispositivo.
* Identificador del vehículo.
* Estado.
* Puerta.
* Vibración.
* Alerta.
* Latitud.
* Longitud.
* Velocidad.

No requiere JWT porque el ESP32 no inicia sesión como usuario.

---

### `routes/vehiculos.py`

Contiene endpoints relacionados con vehículos.

Endpoints principales:

```text
GET    /api/vehiculos
POST   /api/vehiculos
GET    /api/vehiculos/<id>
PUT    /api/vehiculos/<id>
PUT    /api/vehiculos/<id>/desactivar
GET    /api/vehiculos/<id>/eventos
GET    /api/choferes
```

Se usa para:

* Listar vehículos.
* Crear vehículos.
* Editar vehículos.
* Desactivar vehículos.
* Consultar detalle.
* Obtener eventos.
* Consultar choferes disponibles.

---

### `routes/alertas.py`

Contiene endpoints relacionados con alertas.

Endpoints principales:

```text
GET /api/alertas
PUT /api/alertas/<id>/atender
```

Se usa para:

* Listar alertas.
* Marcar alertas como atendidas.
* Registrar eventos de atención.

---

### `routes/historial.py`

Contiene endpoints de historial GPS y eventos.

Endpoint principal:

```text
GET /api/historial/<vehiculo_id>
```

Se usa para mostrar recorridos y eventos históricos de un vehículo.

---

### `routes/dispositivos.py`

Contiene endpoints relacionados con dispositivos físicos.

Endpoints principales:

```text
GET  /api/dispositivos
POST /api/dispositivos/vincular
```

Se usa para que el técnico o administrador pueda consultar dispositivos y vincularlos a vehículos.

---

### `routes/usuarios.py`

Contiene endpoints para administración de usuarios.

Endpoints principales:

```text
GET  /api/usuarios
POST /api/usuarios
GET  /api/usuarios/<id>
PUT  /api/usuarios/<id>
PUT  /api/usuarios/<id>/desactivar
PUT  /api/usuarios/<id>/reactivar
PUT  /api/usuarios/<id>/reset-password
```

Se usa para administrar choferes y supervisores.

---

### `routes/configuracion.py`

Contiene endpoints para configuración del dueño o administrador.

Endpoints principales:

```text
GET /api/dueno/configuracion
PUT /api/dueno/perfil
PUT /api/dueno/password
PUT /api/dueno/empresa
```

Se usa para actualizar perfil, empresa y contraseña.

---

### `routes/planes.py`

Contiene endpoints relacionados con planes y servicios.

Endpoints principales:

```text
GET /api/planes
GET /api/servicios
```

---

### `routes/push.py`

Contiene endpoints para notificaciones push.

Endpoint principal:

```text
POST /api/push/subscribe
```

Se usa para guardar la suscripción del navegador o dispositivo móvil.

---

## Roles del sistema

TrackSecurity maneja diferentes tipos de usuario:

### Dueño

Puede:

* Ver dashboard.
* Crear vehículos.
* Editar vehículos.
* Desactivar vehículos.
* Crear usuarios.
* Editar usuarios.
* Ver alertas.
* Atender alertas.
* Consultar historial.
* Configurar empresa.
* Cambiar su perfil.

### Administrador

Tiene permisos similares al dueño, con acceso más amplio según configuración del sistema.

### Supervisor

Puede consultar vehículos, alertas e historial de la empresa.

### Chofer

Puede consultar información relacionada con su vehículo asignado.

### Técnico

Puede consultar dispositivos y vincular dispositivos físicos a vehículos.

---

## Endpoints principales del sistema

### Autenticación

```text
POST /api/login
```

Inicia sesión y devuelve un JWT.

---

### Dashboard

```text
GET /api/estado
```

Devuelve el estado general de los vehículos visibles para el usuario autenticado.

---

### ESP32

```text
POST /datos
```

Recibe datos enviados por el dispositivo instalado en el vehículo.

---

### Vehículos

```text
GET    /api/vehiculos
POST   /api/vehiculos
GET    /api/vehiculos/<id>
PUT    /api/vehiculos/<id>
PUT    /api/vehiculos/<id>/desactivar
GET    /api/vehiculos/<id>/eventos
```

---

### Alertas

```text
GET /api/alertas
PUT /api/alertas/<id>/atender
```

---

### Historial

```text
GET /api/historial/<vehiculo_id>
```

---

### Usuarios

```text
GET  /api/usuarios
POST /api/usuarios
GET  /api/usuarios/<id>
PUT  /api/usuarios/<id>
PUT  /api/usuarios/<id>/desactivar
PUT  /api/usuarios/<id>/reactivar
PUT  /api/usuarios/<id>/reset-password
```

---

### Dispositivos

```text
GET  /api/dispositivos
POST /api/dispositivos/vincular
```

---

### Configuración

```text
GET /api/dueno/configuracion
PUT /api/dueno/perfil
PUT /api/dueno/password
PUT /api/dueno/empresa
```

---

## Instalación del proyecto

### 1. Clonar el repositorio

```bash
git clone URL_DEL_REPOSITORIO
cd TrackSecurity
```

---

### 2. Crear entorno virtual

En Windows:

```bash
python -m venv .venv
```

Activar entorno virtual:

```bash
.venv\Scripts\activate
```

En PowerShell, si aparece error de permisos:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.venv\Scripts\Activate.ps1
```

---

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

---

### 4. Configurar variables de entorno

Crear un archivo `.env` en la raíz del proyecto.

Ejemplo:

```env
FLASK_ENV=development
SECRET_KEY=TrackSecurity2026
JWT_SECRET_KEY=TrackSecurityJWT2026

LOCAL_DATABASE_URL=mysql+pymysql://root:TU_PASSWORD@localhost:3306/tracksecurity
```

Si se usa Railway o producción:

```env
DATABASE_URL=mysql+pymysql://usuario:password@host:puerto/base_de_datos
```

---

### 5. Crear base de datos MySQL

En MySQL, crear la base de datos:

```sql
CREATE DATABASE tracksecurity;
```

---

### 6. Ejecutar el servidor

```bash
python app.py
```

El sistema se ejecutará en:

```text
http://127.0.0.1:5000
```

También estará disponible en la red local si se ejecuta con:

```python
app.run(host="0.0.0.0", port=5000, debug=True)
```

---

## Usuarios iniciales de prueba

El sistema crea usuarios iniciales al ejecutar `crear_datos_iniciales()`.

### Dueño demo

```text
Correo: admin@gmail.com
Contraseña: admin123
Rol: dueno
```

### Técnico demo

```text
Correo: tecnico@gmail.com
Contraseña: tecnico123
Rol: tecnico
```

---

## Flujo básico de uso

1. Iniciar sesión con el dueño demo.
2. Crear un chofer.
3. Crear un vehículo.
4. Asignar chofer al vehículo.
5. Vincular dispositivo si aplica.
6. Simular datos desde ESP32.
7. Ver estado en dashboard.
8. Generar alerta.
9. Atender alerta.
10. Revisar historial.

---

## Datos enviados por el ESP32

Ejemplo de JSON que puede enviar el ESP32:

```json
{
  "serie": "TS-000001",
  "vehiculo": "camion_1",
  "estado": "activo",
  "alerta": 0,
  "puerta": "cerrada",
  "vibracion": 0,
  "lat": 16.7531,
  "lng": -93.1156,
  "velocidad": 45
}
```

Ejemplo de alerta:

```json
{
  "serie": "TS-000001",
  "vehiculo": "camion_1",
  "estado": "alerta",
  "alerta": 1,
  "puerta": "abierta",
  "vibracion": 1,
  "lat": 16.7531,
  "lng": -93.1156,
  "velocidad": 0
}
```

---

## Validaciones importantes

### Vehículos

No se debe repetir:

* Identificador del vehículo.
* Placa dentro de la misma empresa.
* Chofer asignado a otro vehículo activo.

Campos importantes:

* `nombre`
* `identificador`
* `placa`
* `marca`
* `modelo`
* `anio`
* `chofer_id`

---

### Usuarios

No se debe repetir:

* Correo electrónico.

Campos importantes:

* `nombre`
* `correo`
* `password`
* `tipo`
* `telefono`

Tipos permitidos:

```text
dueno
admin
supervisor
chofer
tecnico
```

---

### Dispositivos

No se debe repetir:

* Serie.
* IMEI, si está registrado.

Campos importantes:

* `serie`
* `imei`
* `pin_activacion`
* `modelo`
* `firmware`
* `estado`

---

## Ramas recomendadas en Git

Estructura sugerida:

```text
main
release/v1.0
dev/jeizer
dev/rodrigo
```

### `main`

Rama principal estable.

No se recomienda trabajar directamente aquí.

---

### `release/v1.0`

Versión estable para presentación o entrega.

---

### `dev/jeizer`

Rama de desarrollo de Jeizer.

Principalmente para:

* Backend.
* Flask.
* Base de datos.
* API.
* ESP32.
* Lógica del sistema.

---

### `dev/rodrigo`

Rama de desarrollo de Rodrigo.

Principalmente para:

* HTML.
* CSS.
* JavaScript.
* Responsive.
* Diseño visual.
* Experiencia de usuario.

---

## Flujo recomendado con Git

Antes de trabajar:

```bash
git checkout dev/jeizer
git pull
```

Guardar cambios:

```bash
git add .
git commit -m "Descripción clara del cambio"
git push
```

Para Rodrigo:

```bash
git checkout dev/rodrigo
git pull
```

Guardar cambios:

```bash
git add .
git commit -m "Descripción clara del cambio"
git push
```

---

## Buenas prácticas del proyecto

* No trabajar directamente sobre `main`.
* Hacer commits pequeños y claros.
* Probar antes de fusionar ramas.
* No subir contraseñas reales.
* No subir archivos `.env`.
* No subir la carpeta `.venv`.
* Evitar mezclar cambios de backend y frontend en el mismo commit.
* Mantener los endpoints documentados.
* Mantener los nombres de rutas claros.
* Comentar funciones importantes.
* Evitar duplicar código.

---

## Archivos que no deberían subirse al repositorio

Se recomienda tener un archivo `.gitignore` con:

```gitignore
.venv/
__pycache__/
*.pyc
.env
instance/
*.log
.DS_Store
.vscode/
.idea/
static/uploads/
```

---

## Estado actual del proyecto

Actualmente el sistema cuenta con:

* Backend Flask modularizado.
* Autenticación con JWT.
* Dashboard web.
* Gestión de vehículos.
* Gestión de usuarios.
* Gestión de alertas.
* Historial GPS.
* Configuración de empresa.
* Recepción de datos desde ESP32.
* Validaciones básicas de vehículos.
* Actualización automática del listado de vehículos.
* Roles de usuario.
* Base de datos MySQL con SQLAlchemy.

---

## Pendientes o mejoras futuras

Posibles mejoras:

* Validaciones más completas en usuarios.
* Mejor manejo de mensajes de error.
* Filtros avanzados en historial.
* Reportes descargables.
* Notificaciones push reales.
* App móvil Flutter.
* Integración completa con SIM7600G-H.
* Captura de evidencia fotográfica.
* Panel técnico para instalación.
* Mejoras visuales en alertas.
* Exportar reportes a PDF o Excel.
* Pruebas automatizadas.

---

## Créditos

Proyecto desarrollado por:

* Jeizer Oswaldo Guzmán Chablé
* Rodrigo

Proyecto desarrollado para Innovatec.

---

## Nombre del proyecto

TrackSecurity

Sistema IoT de monitoreo y seguridad para vehículos de carga.
