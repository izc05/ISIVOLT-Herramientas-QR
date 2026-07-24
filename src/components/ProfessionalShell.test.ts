import { describe, expect, it } from 'vitest';
import { resolveProfessionalRoute } from './ProfessionalShell';

describe('resolveProfessionalRoute', () => {
  it('resuelve las rutas visibles de la aplicación', () => {
    expect(resolveProfessionalRoute('Inicio')).toBe('dashboard');
    expect(resolveProfessionalRoute('Inventario')).toBe('inventory');
    expect(resolveProfessionalRoute('Herramientas')).toBe('inventory');
    expect(resolveProfessionalRoute('Técnicos')).toBe('technicians');
    expect(resolveProfessionalRoute('Historial')).toBe('history');
    expect(resolveProfessionalRoute('Movimientos')).toBe('history');
  });

  it('acepta variantes sin tilde y descarta acciones no navegables', () => {
    expect(resolveProfessionalRoute('Tecnicos')).toBe('technicians');
    expect(resolveProfessionalRoute('Escanear')).toBeNull();
    expect(resolveProfessionalRoute('Más')).toBeNull();
  });
});
