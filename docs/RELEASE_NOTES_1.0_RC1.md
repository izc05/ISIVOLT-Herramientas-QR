# ISIVOLT Herramientas QR 1.0.0-rc.1

## Candidata de producción

Esta versión consolida el trabajo desarrollado desde la base visual hasta la seguridad y la preparación de despliegue.

## Funciones principales

- Inventario de herramientas con fotografías y QR.
- Directorio de técnicos.
- Entregas y devoluciones individuales o múltiples.
- Cámara QR nativa y entrada manual de respaldo.
- Estados, reservas, accesorios e incidencias.
- Revisiones, calibraciones y mantenimiento.
- Alertas por retrasos y vencimientos.
- Excel operativo y Excel de gestión.
- Copias de seguridad y restauración.
- SQLite relacional con migraciones y transacciones.
- Historial inmutable y rectificaciones.
- Usuarios locales con PIN y roles.
- Auditoría, diagnóstico y puesta en servicio.

## Novedades de la candidata

- Icono adaptativo y splash propios.
- Versionado Android automático.
- Centro integrado de pruebas del dispositivo.
- Checklist y manuales de piloto.
- Automatización para APK y AAB release.
- Verificación de firma cuando existe keystore.
- Pruebas de flujo completo de almacén.
- Validación automática de coherencia de versión.

## Limitaciones conocidas

- La firma release requiere configurar los secretos privados del repositorio.
- La versión estable depende de completar el piloto físico.
- Las fotografías antiguas almacenadas como Base64 pueden aumentar el tamaño de las copias.
- La sincronización entre varios dispositivos todavía no está implementada.
- La recuperación remota de PIN no está disponible en modo completamente offline.

## Criterio para promover a 1.0.0

La candidata podrá promoverse cuando:

- Todos los puntos críticos del checklist estén correctos.
- No haya fallos de cámara, SQLite, actualización o restauración.
- La APK release esté firmada y verificada.
- El piloto de inventario reducido no presente incidencias bloqueantes.
- Se haya comprobado la conservación de datos al actualizar.