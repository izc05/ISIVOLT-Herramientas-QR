# Auditoría de la APK recibida — RC7 NFC FINAL

## Identificación confirmada

La APK analizada se identifica internamente como `1.0.0-rc.7`. El paquete contiene una aplicación Capacitor con React, SQLite, ML Kit Barcode Scanning, cámara, NFC, impresión, Excel, copias JSON, mantenimiento, auditoría, rectificaciones y puesta en servicio.

El nombre del archivo recibido es `ISIVOLT-Herramientas-QR-RC7-NFC-FINAL.apk`. Por tanto, esta APK no representa la RC29 mencionada como versión instalada actual y no puede utilizarse para recuperar funciones exclusivas introducidas entre RC8 y RC29.

## Funciones verificadas en el paquete compilado

- Inventario y fichas de herramientas.
- Técnicos y códigos QR internos.
- Préstamos y devoluciones.
- Historial y auditoría.
- Mantenimiento y alertas.
- Rectificaciones enlazadas.
- Puesta en servicio.
- Exportación Excel y copia JSON.
- Cámara ML Kit con lectura de QR y códigos lineales.
- NFC como vía adicional.
- Impresión de códigos.
- Saludo configurable existente en forma básica.

## Diferencias ya superadas por la rama RC24

La rama `agent/rc24-storage-safety` conserva lo anterior y añade:

- Pantalla de revisión previa de cada lote.
- Inicio por técnico o por herramienta.
- Condición individual en devoluciones múltiples.
- `operationId` persistente y protección contra duplicados.
- Escritura SQLite ordenada y recuperación tras cierre inesperado.
- Código de barras de tarjeta corporativa asociado al técnico.
- SQLite v5 con tarjeta incluida en copia y restauración.
- Filtros temporales del historial y descarga CSV de auditoría.
- Navegación Android, safe areas y botón Atrás mejorados.
- APK paralela que no sustituye la versión instalada.

## Decisión de desarrollo

No se debe reconstruir RC24 tomando RC7 como referencia visual final, porque provocaría una regresión respecto a RC29. RC7 se conserva únicamente como referencia de funciones básicas y compatibilidad nativa.

Para completar la paridad real se necesita analizar la APK exacta que muestre internamente RC29, o realizar una comparación pantalla por pantalla con la aplicación RC29 instalada.

## Siguiente bloque

1. Mantener todas las funciones verificadas de RC7.
2. Probar físicamente la lectura de la tarjeta corporativa.
3. Comparar cabecera, tarjetas, filtros, menús y operaciones con RC29.
4. Añadir a la matriz `docs/RC29_PARITY.md` cada diferencia real encontrada.
5. No fusionar con `main` hasta superar el piloto en Android.
