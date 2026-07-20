# Recuperación funcional respecto a la APK RC29

Esta matriz evita seguir construyendo sobre una versión incompleta. Cada función se recupera en código fuente, con prueba automática cuando es posible y validación física en Android cuando depende de cámara, NFC, impresión o navegación del sistema.

> La APK RC29 instalada todavía no está disponible en el repositorio ni en la biblioteca de archivos. La comparación final pantalla por pantalla se realizará en el móvil; esta matriz recoge las funciones indicadas y las ya recuperadas en GitHub.

## Identificación y operaciones

| Función RC29 | Estado en GitHub | Próximo control |
|---|---|---|
| Préstamo y devolución con confirmación final | Recuperada | Probar lote real en Android |
| Empezar primero por técnico o por herramienta | Recuperada | Probar ambos recorridos |
| Búsqueda manual de herramientas | Recuperada | Revisar filtros y tamaño móvil |
| Búsqueda de técnicos por nombre, código y especialidad | Recuperada | Comparar velocidad con RC29 |
| Condición individual en devoluciones múltiples | Recuperada | Probar Correcta/Revisión/Averiada |
| Bloqueo de doble pulsación | Recuperada | Pulsación rápida repetida |
| Código de barras de tarjeta corporativa | Recuperada en código y SQLite v5 | Probar físicamente CODE 39 `52502` |
| Tarjeta incluida en copia y restauración | Recuperada | Exportar JSON, restaurar y volver a leer |
| NFC | Se conserva como vía opcional | No bloquear el flujo si móvil o tarjeta no responden |
| Mensajes diferenciados para salida, entrada e incidencia | Recuperada | Confirmar verde, rojo y ámbar en móvil |

## Técnicos e inventario

| Función RC29 | Estado en GitHub | Próximo control |
|---|---|---|
| Técnicos en dos columnas, tamaño similar a herramientas | Recuperada | Revisar teléfonos estrechos y nombres largos |
| Colores por categoría/especialidad de técnico | Recuperada | Confirmar consistencia tras reiniciar |
| Tarjetas compactas de herramientas | Parcial | Comparar altura y densidad con RC29 |
| Filtros plegables tipo cortina | Recuperados en Técnicos | Extender el mismo patrón al Inventario si mejora el uso |
| Selección manual rápida | Recuperada parcialmente | Reducir pasos restantes |
| Fotografías de herramienta | Recuperada | Probar cámara y galería |
| Impresión QR individual y por grupo | Existente, pendiente de verificación | Probar diálogo e impresora Android |

## Historial y auditoría

| Función RC29 | Estado en GitHub | Próximo control |
|---|---|---|
| Fecha y hora completa en cada movimiento | Recuperada | Revisar formato en pantalla pequeña |
| Filtros Hoy, Ayer, 7 días, 30 días, mes y rango | Recuperados | Probar límites de fechas |
| Salida verde, entrada roja e incidencia ámbar | Recuperada | Validar contraste y accesibilidad |
| Descarga de auditoría | Recuperada en CSV UTF-8 | Abrir en Excel desde Android |
| Movimientos inmutables y rectificación enlazada | Recuperada | Probar rectificación física |
| `operationId` anti-duplicados | Recuperada | Cerrar y abrir durante guardado |

## Interfaz Android

| Función RC29 | Estado en GitHub | Próximo control |
|---|---|---|
| Herramientas administrativas agrupadas | Recuperada en menú único móvil | Comprobar permisos por rol |
| Botones separados de navegación Android | Recuperada mediante safe areas | Revisar distintos modos de navegación |
| Botón Atrás cierra modal antes de salir | Recuperado en código | Probar modal → Inicio → doble Atrás |
| Logo ISIVOLT con efecto radar | Recuperado | Confirmar fluidez y consumo razonable |
| Efecto visual de prestar/devolver | Recuperado | Salida verde, entrada roja, incidencia ámbar |
| Saludo configurable (`Buenos días, Isi`) | Recuperado | Confirmar persistencia y cambio de franja horaria |
| Cabecera y buscador compactos | Pendiente de comparación física | Recuperar proporciones finales RC29 |

## Orden de trabajo restante

1. Esperar validación completa de TypeScript, SQLite v5 y Android.
2. Generar APK paralela nueva sin sustituir RC29.
3. Asociar una tarjeta real a un técnico y probar préstamo/devolución.
4. Probar Historial, CSV, Atrás, safe areas y menú administrativo.
5. Verificar impresión QR individual y por grupo.
6. Comparar cabecera, inventario y todos los detalles visuales con RC29 instalada.
7. Corregir diferencias y repetir el checklist antes de fusionar.

La rama no debe fusionarse con `main` hasta completar la comparación física y confirmar que la nueva candidata no elimina ninguna función útil de RC29.
