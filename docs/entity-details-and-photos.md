# Fichas completas y fotografías

## Separación de pantallas

- **Inventario** mantiene la edición rápida de código, categoría, ubicación y estado.
- **Fichas** concentra fotografías, datos técnicos, mantenimiento, observaciones y estados operativos.

## Fotografías locales

Las fotografías se comprimen a JPEG con una dimensión máxima de 1600 píxeles y calidad 0,82. El archivo resultante se guarda en IndexedDB, no en `localStorage` ni como Base64.

Cada herramienta o técnico puede guardar hasta cinco fotografías y marcar una como principal.

## Herramientas

La ficha permite editar:

- tipo de artículo;
- categoría y ubicación;
- estado de servicio;
- marca, modelo y serie;
- descripción y observaciones;
- compra, revisión y calibración;
- cantidad, stock mínimo y unidad en consumibles;
- galería de fotografías.

## Técnicos

La ficha permite editar:

- especialidad;
- estado operativo;
- empresa y departamento;
- teléfono y correo;
- observaciones;
- galería de fotografías;
- resumen de material asignado y movimientos.

## Copias

La copia JSON contiene las referencias de las fotografías, pero no los blobs locales de IndexedDB. Mientras PocketBase no esté activado, las fotos permanecen en el dispositivo donde se tomaron. La sincronización real de archivos se incorporará al desplegar el servidor central.
