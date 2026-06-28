# 🔌 API EJEMPLOS - TrackSecurity

Ejemplos de cómo usar todos los endpoints del sistema.

---

## 🔐 AUTENTICACIÓN

### 1. Registro - Crear Dueño
```bash
curl -X POST http://localhost:5000/api/registro \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan García López",
    "correo": "juan@empresa.com",
    "password": "Abc123456",
    "tipo": "dueno"
  }'

# Respuesta (201):
# {
#   "ok": true,
#   "mensaje": "cuenta creada exitosamente"
# }
```

### 2. Registro - Crear Chofer
```bash
curl -X POST http://localhost:5000/api/registro \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Carlos Rodríguez",
    "correo": "carlos@empresa.com",
    "password": "Pass1234",
    "tipo": "chofer"
  }'
```

### 3. Login - Dueño
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "correo": "juan@empresa.com",
    "password": "Abc123456"
  }'

# Respuesta (200):
# {
#   "ok": true,
#   "id": 1,
#   "nombre": "Juan García López",
#   "tipo": "dueno"
# }

# Guardar en localStorage:
# localStorage.setItem("id_usuario", 1);
# localStorage.setItem("nombre", "Juan García López");
# localStorage.setItem("tipo", "dueno");
```

### 4. Login - Chofer
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "correo": "carlos@empresa.com",
    "password": "Pass1234"
  }'

# Respuesta (200):
# {
#   "ok": true,
#   "id": 2,
#   "nombre": "Carlos Rodríguez",
#   "tipo": "chofer"
# }
```

---

## 🚗 GESTIÓN DE VEHÍCULOS

### 5. Crear Vehículo (como Dueño)
```bash
# Primero: hacer login como dueño (id_usuario=1)
# Luego usar la cookie/session

curl -X POST http://localhost:5000/api/vehiculos \
  -H "Content-Type: application/json" \
  -b "session=<session_cookie>" \
  -d '{
    "nombre": "Camión A-001",
    "identificador": "camion_1"
  }'

# Respuesta (201):
# {
#   "ok": true,
#   "vehiculo_id": 1,
#   "nombre": "Camión A-001",
#   "identificador": "camion_1"
# }
```

### 6. Crear Vehículo - Error (como Chofer)
```bash
# Primero: hacer login como chofer (id_usuario=2)

curl -X POST http://localhost:5000/api/vehiculos \
  -H "Content-Type: application/json" \
  -b "session=<session_cookie>" \
  -d '{
    "nombre": "Camión A-002",
    "identificador": "camion_2"
  }'

# Respuesta (403):
# {
#   "error": "solo los dueños pueden agregar vehículos"
# }
```

---

## 👤 ASIGNACIÓN DE CHOFERES (NUEVO)

### 7. Asignar Chofer a Vehículo (como Dueño)
```bash
# Prerequisitos:
# 1. Estar autenticado como dueño (id_usuario=1)
# 2. Vehículo existe (vehiculo_id=1)
# 3. Chofer existe (chofer_id=2, tipo='chofer')

curl -X POST http://localhost:5000/api/vehiculos/1/asignar \
  -H "Content-Type: application/json" \
  -b "session=<session_cookie>" \
  -d '{
    "chofer_id": 2
  }'

# Respuesta (200):
# {
#   "ok": true,
#   "mensaje": "chofer Carlos Rodríguez asignado al vehículo",
#   "chofer_id": 2,
#   "chofer_nombre": "Carlos Rodríguez"
# }
```

### 8. Desasignar Chofer de Vehículo (como Dueño)
```bash
curl -X POST http://localhost:5000/api/vehiculos/1/asignar \
  -H "Content-Type: application/json" \
  -b "session=<session_cookie>" \
  -d '{
    "chofer_id": null
  }'

# Respuesta (200):
# {
#   "ok": true,
#   "mensaje": "chofer desasignado"
# }
```

### 9. Error: Asignar sin ser Dueño
```bash
# Intenta como chofer (chofer_id=2)

curl -X POST http://localhost:5000/api/vehiculos/1/asignar \
  -H "Content-Type: application/json" \
  -b "session=<session_cookie>" \
  -d '{
    "chofer_id": 2
  }'

# Respuesta (403):
# {
#   "error": "solo los dueños pueden asignar choferes"
# }
```

### 10. Error: Asignar Usuario que no es Chofer
```bash
# Intenta asignar a otro dueño (id=1)

curl -X POST http://localhost:5000/api/vehiculos/1/asignar \
  -H "Content-Type: application/json" \
  -b "session=<session_cookie>" \
  -d '{
    "chofer_id": 1
  }'

# Respuesta (404):
# {
#   "error": "chofer no existe"
# }
```

---

## 📊 ESTADO EN TIEMPO REAL

### 11. Obtener Estado (como Dueño)
```bash
# Dueño con id_usuario=1 ve sus vehículos

curl -X GET http://localhost:5000/estado \
  -b "session=<session_cookie>"

# Respuesta (200):
# {
#   "Camión A-001": {
#     "vehiculo": "Camión A-001",
#     "estado": "conectado",
#     "alerta": 0,
#     "puerta": "cerrada",
#     "vibracion": 0,
#     "timestamp": 1713696000
#   }
# }
```

### 12. Obtener Estado (como Chofer)
```bash
# Chofer con id_usuario=2 VE SOLO su vehículo asignado

curl -X GET http://localhost:5000/estado \
  -b "session=<session_cookie>"

# Si tiene vehículo asignado:
# {
#   "Camión A-001": {
#     "vehiculo": "Camión A-001",
#     "estado": "conectado",
#     "alerta": 0,
#     "puerta": "cerrada",
#     "vibracion": 0,
#     "timestamp": 1713696000
#   }
# }

# Si NO tiene vehículo asignado:
# {}
```

### 13. Error: sin Autenticación
```bash
curl -X GET http://localhost:5000/estado

# Respuesta (401):
# {
#   "error": "no autenticado"
# }
```

---

## 📡 ESP32 - ENVÍO DE DATOS

### 14. ESP32 Envía Datos
```bash
# Desde ESP32 (Arduino IDE):

curl -X POST http://192.168.1.X:5000/datos \
  -H "Content-Type: application/json" \
  -d '{
    "vehiculo": "camion_1",
    "estado": "conectado",
    "alerta": 0,
    "puerta": "cerrada",
    "vibracion": 0
  }'

# Respuesta (200):
# {
#   "ok": true
# }

# Backend:
# 1. Busca Vehiculo.identificador = "camion_1"
# 2. Obtiene id_vehiculo = 1
# 3. Limpia datos > 24 horas (si necesario)
# 4. Guarda Historial con id_vehiculo=1
```

### 15. ESP32 - Alerta Activa
```bash
curl -X POST http://192.168.1.X:5000/datos \
  -H "Content-Type: application/json" \
  -d '{
    "vehiculo": "camion_1",
    "estado": "alerta",
    "alerta": 1,
    "puerta": "abierta",
    "vibracion": 1
  }'

# Dashboard mostrará:
# - Barra roja de alerta
# - Valores en rojo
# - "Alerta activa — revisar unidad"
```

---

## 🔑 VALIDACIONES FRONTEND

### Errores que rechaza el Frontend (antes de enviar):

**Registro:**
```
✗ "El nombre es requerido"
✗ "El correo es requerido"
✗ "Correo inválido"
✗ "La contraseña es requerida"
✗ "Mínimo 6 caracteres"
✗ "Debe contener al menos 1 número"
✗ "Debe contener al menos 1 letra"
✗ "Selecciona un tipo de usuario"
```

**Login:**
```
✗ "El correo es requerido"
✗ "Correo inválido"
✗ "La contraseña es requerida"
```

**Crear Vehículo:**
```
✗ "El nombre es requerido"
✗ "El identificador es requerido"
```

---

## 🔑 VALIDACIONES BACKEND

### Errores que rechaza el Backend (si frontend falla):

**Registro (400 Bad Request):**
```
"campos incompletos"
"todos los campos son requeridos"
"correo inválido"
"tipo de usuario inválido"
"La contraseña debe tener al menos 6 caracteres"
"La contraseña debe contener al menos 1 número"
"La contraseña debe contener al menos 1 letra"
"correo ya registrado"
```

**Login (401 Unauthorized):**
```
"correo y contraseña requeridos"
"correo o contraseña incorrectos"
```

**Vehículos (400/401/403/409):**
```
401: "no autenticado"
403: "solo los dueños pueden agregar vehículos"
400: "nombre e identificador requeridos"
400: "nombre e identificador no pueden estar vacíos"
409: "identificador ya existe"
```

---

## 🧪 FLUJO DE TESTING COMPLETO

### Paso 1: Registrar Dueño
```bash
curl -X POST http://localhost:5000/api/registro \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan García","correo":"juan@test.com","password":"Abc123456","tipo":"dueno"}'
# → Respuesta 201: OK
```

### Paso 2: Registrar Chofer
```bash
curl -X POST http://localhost:5000/api/registro \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Carlos Rodríguez","correo":"carlos@test.com","password":"Pass1234","tipo":"chofer"}'
# → Respuesta 201: OK
```

### Paso 3: Login como Dueño
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"correo":"juan@test.com","password":"Abc123456"}'
# → Respuesta 200: id=1, tipo="dueno"
```

### Paso 4: Crear Vehículo
```bash
curl -X POST http://localhost:5000/api/vehiculos \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"nombre":"Camión A-001","identificador":"camion_1"}'
# → Respuesta 201: vehiculo_id=1
```

### Paso 5: Login como Chofer
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -c cookies_chofer.txt \
  -d '{"correo":"carlos@test.com","password":"Pass1234"}'
# → Respuesta 200: id=2, tipo="chofer"
```

### Paso 6: Asignar Chofer a Vehículo
```bash
curl -X POST http://localhost:5000/api/vehiculos/1/asignar \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"chofer_id":2}'
# → Respuesta 200: OK, chofer_id=2
```

### Paso 7: Verificar Estado como Dueño
```bash
curl -X GET http://localhost:5000/estado \
  -b cookies.txt
# → Respuesta 200: JSON con vehículos
```

### Paso 8: Verificar Estado como Chofer
```bash
curl -X GET http://localhost:5000/estado \
  -b cookies_chofer.txt
# → Respuesta 200: JSON con solo su vehículo
```

### Paso 9: ESP32 Envía Datos
```bash
curl -X POST http://localhost:5000/datos \
  -H "Content-Type: application/json" \
  -d '{"vehiculo":"camion_1","estado":"conectado","alerta":0,"puerta":"cerrada","vibracion":0}'
# → Respuesta 200: OK
```

### Paso 10: Verificar Datos en Dashboard
```bash
curl -X GET http://localhost:5000/estado \
  -b cookies.txt
# → Respuesta 200: Incluye datos del ESP32
```

---

## 📝 NOTAS IMPORTANTES

1. **Cookies/Session:** Flask maneja sesiones automáticamente
   - Use `-b` en curl para enviar cookies
   - Use `-c` en curl para guardar cookies

2. **CORS:** Está habilitado para requests desde otros orígenes

3. **JSON:** Todos los requests usan `Content-Type: application/json`

4. **Errores 400/401/403:** Lee el mensaje en `"error"` para detalles

5. **Timestamps:** En formato Unix (segundos desde epoch)

---

## 🚀 TESTING CON POSTMAN

1. Importar este archivo como colección
2. Variables de ambiente:
   - `base_url`: http://localhost:5000
   - `dueño_id`: 1
   - `chofer_id`: 2
   - `vehiculo_id`: 1

3. Ejecutar en orden:
   1. POST Registro Dueño
   2. POST Registro Chofer
   3. POST Login Dueño
   4. POST Crear Vehículo
   5. POST Login Chofer
   6. POST Asignar Chofer
   7. GET Estado (Dueño)
   8. GET Estado (Chofer)
   9. POST ESP32 Datos

---

## ✅ RESULTADOS ESPERADOS

| Endpoint | Dueño | Chofer |
|----------|-------|--------|
| POST /api/registro | ✅ | ✅ |
| POST /api/login | ✅ | ✅ |
| POST /api/vehiculos | ✅ | ❌ 403 |
| POST /api/vehiculos/:id/asignar | ✅ | ❌ 403 |
| GET /estado | ✅ todos | ✅ solo asignado |
| POST /datos | ✅ | ✅ |
| GET /logout | ✅ | ✅ |

---

**Sistema de APIs - TrackSecurity v1.0.0**
