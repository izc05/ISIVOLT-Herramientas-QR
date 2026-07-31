import type { Technician } from '../domain/types';

/**
 * RC57 parte de un espacio de trabajo limpio.
 *
 * El antiguo directorio precargado se ha retirado para evitar que la aplicación
 * vuelva a crear técnicos después de vaciar los datos. Las altas deben realizarse
 * desde la aplicación o mediante una importación explícita y revisable.
 */
export const hospitalTechnicians: Technician[] = [];

/**
 * Categorías sugeridas para facilitar filtros y altas sin precargar personas.
 * Las categorías personalizadas continúan disponibles desde el formulario.
 */
export const technicianSpecialties = [
  'Mantenimiento',
  'Electricidad',
  'Climatización',
  'Fontanería',
  'Mecánica',
  'PCI',
  'Albañilería',
  'Carpintería',
  'Pintura',
  'Jardinería',
  'Almacén',
  'Centro de control',
] as const;
