# IsiVoltPro Herramientas · Modelo de datos V3

## Objetivo

Preparar fichas completas, fotografías, catálogos y mantenimiento sin alterar el flujo actual de préstamo y devolución.

## Separación de estados

`status` continúa representando la asignación operativa:

- `available`
- `loaned`
- `review`
- `retired`

`serviceState` representa la condición del artículo:

- `ready`
- `reserved`
- `review`
- `repair`
- `lost`
- `retired`

Esta separación evita que una herramienta prestada pierda la información sobre su condición técnica.

## Tipos de artículo

- Herramienta retornable.
- Material prestable.
- Equipo de medida.
- Maletín o conjunto.
- EPI.
- Consumible.
- Otro.

Los registros antiguos migran a `returnable-tool`.

## Nuevos datos de herramienta

- Identificadores de categoría y ubicación.
- Descripción y observaciones.
- Referencias de fotografías.
- Fecha y precio de compra.
- Próxima revisión y calibración.
- Periodicidades.
- Cantidad, stock mínimo y unidad para consumibles.

## Nuevos datos de técnico

- Estado operativo.
- Identificador de categoría.
- Empresa y departamento.
- Observaciones.
- Referencias de fotografías.

## Estados de técnico

- Activo.
- Inactivo.
- Ausente.
- Vacaciones.
- Baja.
- Bloqueado.

El booleano `active` se conserva durante la transición para mantener compatibilidad con las pantallas actuales.

## Catálogos

El esquema local incorpora:

- `toolCategories`
- `technicianCategories`
- `locations`

En esta fase se generan automáticamente a partir de los textos existentes mediante identificadores estables. La administración visual y la sincronización independiente de los catálogos pertenecen a la Fase 3.

## Fotografías

Las fichas guardan únicamente referencias. Los binarios se almacenarán:

- en IndexedDB durante el modo local;
- como archivos PocketBase al activar el servidor.

No se guardarán imágenes Base64 dentro de `localStorage`.

## Migración

`normalizeAppData` acepta esquemas V2 y V3:

1. conserva IDs, códigos, QR, NFC y fechas;
2. conserva movimientos y lotes sin modificarlos;
3. añade valores predeterminados;
4. genera catálogos desde categorías y ubicaciones existentes;
5. persiste el resultado como esquema V3.

Las copias JSON V2 y V3 se restauran mediante el mismo normalizador.

## PocketBase

La migración `1722512400_expand_data_model_v3.js` añade los campos nuevos a técnicos y herramientas. Las reglas impiden que una cuenta técnica modifique los nuevos campos durante un préstamo o una devolución de autoservicio.
