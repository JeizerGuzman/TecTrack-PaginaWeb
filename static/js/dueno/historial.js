// Logica especifica de la pantalla dueno/historial.
// Debe consumir GET /api/historial/<vehiculo_id> para mostrar eventos.

/**
 * Lógica específica de la vista dueño/historial.
 * ------------------------------------------------------------
 * Este archivo queda preparado para implementar consumo de endpoints
 * del backend cuando se construya la pantalla correspondiente.
 */
document.addEventListener('DOMContentLoaded', () => {
  TrackGuards.requireAuth();
  TrackGuards.requireRole(['dueno', 'admin']);
  console.info('Vista dueño/historial lista para implementar.');
});
