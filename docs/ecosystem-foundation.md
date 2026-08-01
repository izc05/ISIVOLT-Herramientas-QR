# Base del ecosistema IsiVoltPro

## Objetivo

IsiVoltPro es la marca principal. Cada aplicación es un módulo especializado que comparte la misma identidad, navegación y reglas de interacción.

La reconstrucción V2 de Herramientas · QR/NFC es el primer módulo operativo construido sobre esta base.

## Módulos registrados

1. Herramientas · QR/NFC — activo.
2. Activos y mantenimiento — siguiente.
3. Órdenes de trabajo — siguiente.
4. Inspecciones eléctricas — planificado.
5. RITE y climatización — planificado.
6. Protección contra incendios — planificado.
7. Control de Legionella — planificado.
8. Inventario y almacén — planificado.
9. Calculadoras técnicas — planificado.

El registro vive en `src/ecosystem/modules.ts`. El selector no contiene rutas inventadas: un módulo solo podrá abrirse cuando exista una aplicación o una ruta real.

## Elementos compartidos

- Marca IsiVoltPro y jerarquía marca → módulo → pantalla.
- Selector de aplicaciones.
- Paleta azul, cian y colores semánticos.
- Tipografía y escala de espaciado.
- Botones, tarjetas, estados, formularios y mensajes.
- Accesibilidad mediante etiquetas, foco, cierre con Escape y reducción de movimiento.
- Diseño responsive para escritorio y móvil.

## Reglas de crecimiento

1. No copiar hojas de estilo completas entre módulos.
2. No añadir componentes de una RC anterior a la V2.
3. Registrar cada módulo en `modules.ts` antes de crear accesos visuales.
4. No habilitar enlaces hasta que exista un destino válido.
5. Mantener los datos de cada módulo en un espacio de almacenamiento aislado.
6. Validar TypeScript, compilación, escritorio y móvil en cada bloque.
7. Incorporar las piezas realmente compartidas a una futura librería `@isivoltpro/ui` cuando haya al menos dos módulos operativos.

## Siguiente evolución técnica

Cuando Activos u OT comiencen su reconstrucción, se extraerán del primer módulo los elementos realmente comunes:

- `EcosystemSwitcher`
- registro de módulos
- tokens de color y espaciado
- botones y estados
- modal base
- cabecera y navegación

Hasta entonces, estos elementos permanecen aislados dentro de la V2 para evitar una abstracción prematura.
