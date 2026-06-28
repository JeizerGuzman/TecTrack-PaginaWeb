// Logica especifica de la pantalla de mapa del dueno.
// Debe visualizar ubicacion y estado del vehiculo con datos provenientes del backend.

/**
 * Lógica específica de la vista dueño/mapa.
 * ------------------------------------------------------------
 * Este archivo queda preparado para implementar consumo de endpoints
 * del backend cuando se construya la pantalla correspondiente.
 */
document.addEventListener('DOMContentLoaded', () => {
  TrackGuards.requireAuth();
  TrackGuards.requireRole(['dueno', 'admin']);
  console.info('Vista dueño/mapa lista para implementar.');
});
