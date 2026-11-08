/*
 * CONFIGURACIÓN DE LA APP – solo hay que tocar este archivo.
 *
 * API_URL: la dirección que da Apps Script al implementar (termina en /exec).
 *          Si se deja vacía, la app funciona en MODO DEMOSTRACIÓN
 *          (datos ficticios guardados solo en el propio móvil; clave: demo).
 * GESTORES: nombres que aparecen en "¿Quién eres?". Se pueden cambiar cuando queráis.
 */
window.CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxfZRTAN0aw1OhemzQdRpVywJRW2UoLMn-2vQwcKB8hkDyrb_MHIqP6tGfkLHPGc6NrYA/exec',
  NOMBRE_CASA: 'Casa María Madre',
  SUBTITULO: 'Guadalajara',
  GESTORES: ['Viviane', 'Rafael', 'Gema', 'Carlos'],
  CAPACIDAD_PREVISTA: 60
};
