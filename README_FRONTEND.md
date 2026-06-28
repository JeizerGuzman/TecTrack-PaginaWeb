# TrackSecurity Frontend

## Organizacion general

- `templates/public/`: landing publica del dominio.
- `templates/auth/`: vistas de acceso y registro.
- `templates/admin/`: panel interno de administracion.
- `templates/dueno/`: panel del dueno de la flota.
- `templates/supervisor/`: monitoreo operativo.
- `templates/chofer/`: vista limitada para chofer.
- `templates/components/`: fragmentos reutilizables de Jinja.
- `templates/base/`: plantillas base compartidas.
- `static/css/global/`: estilos base reutilizables.
- `static/js/global/`: logica compartida entre pantallas.

## Carga inicial recomendada

1. `base.html`
2. `base_auth.html`
3. `login.html`
4. `dueno/dashboard.html`
5. `chofer/dashboard.html`

## Responsabilidad por carpeta

- `public/`: home, paquetes, contacto y nosotros para el sitio publico.
- `auth/`: login y registro.
- `admin/`: usuarios, dispositivos, empresas, planes y servicios.
- `dueno/`: vehiculos, alertas, historial, reportes y usuarios de la flota.
- `supervisor/`: monitoreo, alertas e historial operativo.
- `chofer/`: solo su vehiculo, alertas e historial.
- `components/`: navbar, sidebar, topbar, footer y piezas reusables.
- `base/`: layouts de Jinja que definen estructura comun y bloques.

## Que programar primero

1. `base.html`
2. `base_auth.html`
3. `login.html`
4. `dueno/dashboard.html`
5. `chofer/dashboard.html`

## Notas de integracion

- Los archivos globales deben quedar listos antes de las pantallas por rol.
- `static/js/global/api.js` centraliza las llamadas `fetch` al backend.
- `static/js/global/auth.js` debe manejar JWT, cierre de sesion y usuario activo.
- `static/js/global/guards.js` debe proteger pantallas por rol.
- `static/js/global/ui.js` debe concentrar modales, toasts y render visual.
- `static/js/global/notifications.js` debe preparar suscripcion `POST /api/push/subscribe`.
- El rol de tecnico queda reservado para una app movil futura y no se crea aqui.
