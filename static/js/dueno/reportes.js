// Logica especifica de la pantalla dueno/reportes.
// Debe preparar la lectura de datos para reportes y exportaciones futuras.

/**
 * Lógica específica de la vista dueño/reportes.
 * ------------------------------------------------------------
 * Este archivo queda preparado para implementar consumo de endpoints
 * del backend cuando se construya la pantalla correspondiente.
 */
document.addEventListener('DOMContentLoaded', () => {
  TrackGuards.requireAuth();
  TrackGuards.requireRole(['dueno', 'admin']);
  console.info('Vista dueño/reportes lista para implementar.');
});
