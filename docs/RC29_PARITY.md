# Recuperación funcional respecto a la APK RC29

Esta matriz evita seguir construyendo sobre una versión incompleta. Cada función se recupera en código fuente, con prueba automática cuando es posible y validación física en Android cuando depende de cámara, NFC, impresión o navegación del sistema.

> La APK RC29 instalada todavía no está disponible como código fuente. La APK RC7 aportada se conserva como referencia visual y la RC23 como referencia del flujo seguro. RC30 reúne estas bases sin sustituir la instalación actual.

## Identificación y operaciones

| Función | Estado en GitHub RC30 | Próximo control |
|---|---|---|
| Préstamo y devolución con confirmación final | Recuperada | Probar lote real en Android |
| Empezar primero por técnico o por herramienta | Recuperada | Probar ambos recorridos |
| Búsqueda manual de herramientas | Recuperada | Revisar filtros y tamaño móvil |
| Búsqueda de técnicos por nombre, código, tarjeta y especialidad | Recuperada | Comparar velocidad con RC29 |
| Condición individual en devoluciones múltiples | Recuperada | Probar Correcta/Revisión/Averiada |
| Bloqueo de doble pulsación | Recuperada | Pulsación rápida repetida |
| Código de barras de tarjeta corporativa | Recuperada en código y SQLite v6 | Probar códigos horizontal y vertical |
| Normalización de espacios y guiones | Recuperada y probada | Comparar cámara con introducción manual |
| Tarjeta incluida en copia y restauración | Recuperada | Exportar JSON, restaurar y volver a leer |
| NFC | Se conserva como vía opcional | El flujo no depende de NFC |
| OT y ubicación del trabajo | Incorporada en RC30 | Confirmar persistencia e historial |
| Fecha prevista de devolución | Incorporada en RC30 | Probar propuesta por plazo máximo |
| Checklist de accesorios por movimiento | Incorporado en RC30 | Probar préstamo y devolución real |
| Accesorio ausente o dañado genera incidencia | Incorporado y probado | Confirmar bloqueo visual |
| Mensajes diferenciados para salida, entrada e incidencia | Recuperada | Confirmar verde, rojo y ámbar |

## Técnicos e inventario

| Función | Estado en GitHub RC30 | Próximo control |
|---|---|---|
| Técnicos en dos columnas, tamaño similar a herramientas | Recuperada | Revisar teléfonos estrechos |
| Colores por categoría/especialidad | Recuperada | Confirmar consistencia tras reiniciar |
| Herramientas en dos columnas y tarjetas compactas | Recuperada | Confirmar lectura en móvil real |
| Filtros plegables tipo cortina | Recuperados | Revisar teclado y desplazamiento |
| Selección manual rápida | Recuperada | Medir número de pulsaciones |
| Fotografías de herramienta | Recuperada | Probar cámara y galería |
| Accesorios obligatorios y opcionales | Recuperados y conectados a operaciones | Probar alta y edición |
| Impresión QR individual y por grupo | Existente, pendiente de verificación | Probar diálogo e impresora Android |

## Historial y auditoría

| Función | Estado en GitHub RC30 | Próximo control |
|---|---|---|
| Fecha y hora completa | Recuperada | Revisar formato móvil |
| Filtros Hoy, Ayer, 7 días, 30 días, mes y rango | Recuperados | Probar límites de fechas |
| Salida verde, entrada roja e incidencia ámbar | Recuperada | Validar contraste |
| Descarga de auditoría | Recuperada en CSV UTF-8 | Abrir en Excel desde Android |
| Movimientos inmutables y rectificación enlazada | Recuperada | Probar rectificación física |
| `operationId` anti-duplicados | Recuperada | Cerrar y abrir durante guardado |
| OT, ubicación y vencimiento en SQLite | Recuperados en esquema v6 | Mostrar también en exportaciones |
| Estado de accesorios ligado al movimiento | Recuperado en SQLite | Mostrar también en historial detallado |

## Interfaz Android

| Función | Estado en GitHub RC30 | Próximo control |
|---|---|---|
| Herramientas administrativas agrupadas | Recuperada en menú único | Comprobar permisos por rol |
| Botones separados de navegación Android | Recuperada mediante safe areas | Revisar distintos modos de navegación |
| Botón Atrás cierra modal antes de salir | Recuperado | Probar modal → Inicio → doble Atrás |
| Logo ISIVOLT con efecto radar | Recuperado | Confirmar fluidez |
| Efecto visual de prestar/devolver | Recuperado | Validar colores y duración |
| Saludo configurable | Recuperado | Confirmar persistencia |
| Cabecera y buscador compactos | Pendiente de comparación física | Ajustar proporciones tras capturas |
| Revisión móvil de OT, vencimiento y accesorios | Incorporada en RC30 | Revisar teléfonos pequeños |

## Funciones profesionales todavía no cerradas

| Función nueva | Situación |
|---|---|
| Transferencia directa entre técnicos | Pendiente de diseñar sin romper trazabilidad |
| Inventario físico por sesión de escaneo | Pendiente |
| Kits o maletines de herramientas | Pendiente |
| Fotografías obligatorias en incidencias | Pendiente |
| Panel de préstamos vencidos y próximos | Datos preparados; falta panel final |
| Servidor y sincronización con mini PC | Se realizará después de estabilizar el modo local |

## Validación RC30

- Pruebas de dominio: correctas.
- Migraciones SQLite reales v1-v6: correctas.
- TypeScript y Vite: correctos.
- Validación de producción: correcta.
- APK paralela Android: en generación.
- Application ID de pruebas separado de RC29.
- La lectura de tarjeta no presupone el valor del código; guarda exactamente lo leído.

## Orden de trabajo restante

1. Instalar RC30 como aplicación paralela, sin sustituir RC29.
2. Asociar la tarjeta real y probar préstamo/devolución.
3. Probar OT, ubicación, fecha prevista y accesorios.
4. Probar Historial, CSV, Atrás, safe areas y menú administrativo.
5. Verificar impresión QR individual y por grupo.
6. Comparar cabecera, inventario y detalles visuales con RC29 instalada.
7. Corregir diferencias y repetir el checklist.
8. Implementar transferencias, inventario físico y kits en bloques independientes.

La rama no debe fusionarse con `main` hasta completar la comparación física y confirmar que RC30 no elimina ninguna función útil de RC29.
