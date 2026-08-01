import type { Technician } from '../domain/types';

/**
 * RC58 parte de un espacio de trabajo limpio.
 *
 * El antiguo directorio hospitalario de demostración se ha retirado por
 * privacidad y para evitar que una instalación nueva aparezca precargada.
 * Los técnicos se crean desde la propia aplicación o se importan mediante
 * los flujos administrativos disponibles.
 */
export const hospitalTechnicians: Technician[] = [];

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
];
