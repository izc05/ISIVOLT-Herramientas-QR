# Recuperación funcional respecto a la APK RC29

Esta matriz evita seguir construyendo sobre una versión incompleta. Cada función se recuperará en código fuente, con prueba automática cuando sea posible y validación física en Android cuando dependa de cámara, NFC, impresión o navegación del sistema.

## Identificación y operaciones

| Función RC29 | Estado en GitHub | Próximo control |
|---|---|---|
| Préstamo y devolución con confirmación final | Recuperada | Probar lote real en Android |
| Empezar primero por técnico o por herramienta | Recuperada | Probar ambos recorridos |
| Búsqueda manual de herramientas | Recuperada | Revisar filtros y tamaño móvil |
| Búsqueda de técnicos por nombre, código y especialidad | Recuperada | Comparar con RC29 |
| Condición individual en devoluciones múltiples | Recuperada | Probar Correcta/Revisión/Averiada |
| Bloqueo de doble pulsación | Recuperada | Pulsación rápida repetida |
| Código de barras de tarjeta corporativa | Implementado, pendiente de prueba física | CODE 39 de ejemplo: `52502` |
| NFC | Se conserva como vía opcional | No bloquear el flujo si el móvil o la tarjeta no responden |
| Mensajes visuales diferenciados para salida, entrada e incidencia | Verificar y recuperar estética RC29 | Colores y animación final |

## Técnicos e inventario

| Función RC29 | Estado en GitHub | Próximo control |
|---|---|---|
| Técnicos en dos columnas, tamaño similar a herramientas | Pendiente de recuperar | Ajustar rejilla móvil |
| Colores por categoría de técnico | Pendiente de recuperar | Mantener filtros visibles |
| Tarjetas compactas de herramientas | Parcial | Comparar altura y densidad con RC29 |
| Filtros plegables tipo cortina | Pendiente de recuperar | Evitar botones flotantes superpuestos |
| Selección manual rápida | Recuperada parcialmente | Reducir pasos y mejorar jerarquía |
| Fotografías de herramienta | Recuperada | Probar cámara y galería |
| Impresión QR individual y por grupo | Verificar | Probar impresora/diálogo Android |

## Historial y auditoría

| Función RC29 | Estado en GitHub | Próximo control |
|---|---|---|
| Fecha y hora completa en cada movimiento | Pendiente de recuperar | Formato `dd/mm/aaaa hh:mm:ss` |
| Filtros Hoy, Ayer, 7 días, 30 días, mes y rango | Pendiente de recuperar | Añadir filtro temporal estable |
| Salida verde, entrada roja e incidencia ámbar | Pendiente de recuperar | No depender solo del estado final |
| Descarga de auditoría | Verificar/recuperar | Excel o CSV legible |
| Movimientos inmutables y rectificación enlazada | Recuperada | Probar rectificación |
| `operationId` anti-duplicados | Recuperada | Cerrar y abrir durante guardado |

## Interfaz Android

| Función RC29 | Estado en GitHub | Próximo control |
|---|---|---|
| Barra del administrador fija | Pendiente de comparar | Evitar que tape contenido |
| Botones separados de la navegación Android | Parcial | Revisar safe areas |
| Botón Atrás cierra modal antes de salir | Pendiente de prueba física | Doble Atrás solo desde Inicio |
| Logo ISIVOLT con efecto radar | Pendiente de recuperar | Mantener rendimiento móvil |
| Efecto visual de prestar/devolver | Pendiente de recuperar | Salida y entrada claramente distintas |
| Saludo configurable (`Buenos días, Isi`) | Pendiente de recuperar | Guardar nombre localmente |
| Cabecera y buscador compactos | Pendiente de comparar | Recuperar proporciones RC29 |

## Orden de recuperación

1. Tarjeta corporativa por código de barras y prueba física.
2. Historial completo: filtros, fecha/hora y colores.
3. Técnicos en dos columnas y colores por categoría.
4. Notificaciones y animaciones de préstamo/devolución.
5. Navegación Android, safe areas y barra fija.
6. Auditoría, impresión QR y saludo configurable.
7. Comparación final pantalla por pantalla con la APK RC29 instalada.

La rama no debe fusionarse con `main` hasta completar la comparación física y confirmar que RC24/RC25 no elimina ninguna función útil de RC29.
