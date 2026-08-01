# Centro Operativo IsiVoltPro

## Objetivo

El Centro Operativo es la pantalla de entrada común del ecosistema IsiVoltPro. No sustituye la lógica interna de cada módulo: resume su estado, muestra actividad y dirige al usuario hacia los flujos existentes.

## Separación de responsabilidades

- `src/App.tsx`: mantiene la lógica funcional de Herramientas, técnicos, préstamos, devoluciones, QR y NFC.
- `src/ecosystem/OperationalCenter.tsx`: muestra el resumen operativo y coordina accesos a la aplicación.
- `src/ecosystem/EcosystemSwitcher.tsx`: permite visualizar el módulo activo y la hoja de ruta.
- `src/ecosystem/modules.ts`: registro único de aplicaciones del ecosistema.
- `src/storage.ts`: persistencia local y emisión del evento `isivoltpro-v2:data-changed`.

El Centro Operativo no escribe directamente herramientas, técnicos ni movimientos. Todas las modificaciones siguen pasando por los flujos propios del módulo Herramientas.

## Contrato de datos

Cuando `saveData` guarda el espacio local, emite un `CustomEvent<AppData>` con el nombre:

```text
isivoltpro-v2:data-changed
```

Los componentes del shell pueden escuchar este evento para actualizar KPI, actividad y progreso sin duplicar el estado principal.

## Contrato visual

Todos los próximos módulos deberán reutilizar:

1. Marca IsiVoltPro y jerarquía de módulo.
2. Paleta azul marino, azul, cian y superficies claras.
3. Navegación lateral y selector del ecosistema.
4. Cabeceras, KPI, estados vacíos, botones y tarjetas.
5. Comportamiento responsive sin desplazamiento horizontal.
6. Estados de módulo: `active`, `next` y `planned`.

## Pantalla de Inicio

El Centro Operativo se muestra únicamente cuando la navegación activa es `Inicio`. En las vistas Herramientas, Técnicos y Movimientos se mantiene la interfaz funcional original.

La pantalla incluye:

- Módulo operativo actual.
- KPI de herramientas, disponibilidad, préstamos y técnicos.
- Actividad reciente.
- Progreso de puesta en marcha.
- Acciones rápidas conectadas a los formularios existentes.
- Próximos módulos del ecosistema.

## Próxima evolución

La siguiente aplicación recomendada es **Activos y mantenimiento**, seguida de **Órdenes de trabajo**. Cada módulo debe tener su propia carpeta funcional, almacenamiento o API y rutas, pero compartir el shell y los componentes visuales del ecosistema.
