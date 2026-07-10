# Seguridad local — ISIVOLT Herramientas QR 0.9

## Modelo de acceso

La aplicación funciona sin conexión y dispone de tres roles:

### Administrador

- Gestiona usuarios, técnicos, herramientas y mantenimiento.
- Ejecuta entregas y devoluciones.
- Exporta informes y copias.
- Restaura copias de seguridad.
- Consulta auditoría y diagnóstico.
- Registra rectificaciones de movimientos.

### Responsable de almacén

- Ejecuta entregas y devoluciones.
- Gestiona herramientas, accesorios y mantenimiento.
- Exporta informes y copias.
- No administra usuarios ni restaura copias.

### Técnico

- Acceso de consulta.
- No puede registrar movimientos ni modificar datos.
- Puede vincularse con un técnico del directorio.

## PIN

- El PIN debe contener entre 4 y 8 dígitos.
- No se guarda en texto.
- Se deriva mediante PBKDF2 con SHA-256, 150.000 iteraciones y una sal aleatoria individual.
- Cinco intentos fallidos bloquean temporalmente el usuario durante un minuto.
- Un administrador puede restablecer el PIN de otro usuario.

## Sesiones

- El dispositivo se bloquea automáticamente tras cinco minutos sin actividad.
- La sesión solo conserva el identificador del usuario y las fechas de desbloqueo/actividad.
- El PIN no forma parte de la sesión.
- El usuario puede bloquear o cerrar la sesión manualmente.

## Trazabilidad

- Cada movimiento nuevo utiliza el nombre del usuario autenticado como operador.
- Los movimientos originales no se editan ni se eliminan.
- Una corrección crea un movimiento `adjustment` enlazado mediante `reversedMovementId`.
- Exportaciones, restauraciones, accesos, intentos fallidos y cambios de usuario se registran en la auditoría local.

## Primer inicio

1. Instala o actualiza la APK.
2. Abre la aplicación.
3. Introduce el nombre del administrador inicial.
4. Crea y confirma un PIN de 4 a 8 números.
5. Desde el icono de usuario, crea las cuentas adicionales.

## Recuperación

La seguridad local no incorpora todavía recuperación remota del PIN. Debe mantenerse al menos un administrador activo y conservar una copia de seguridad operativa de los datos. La firma release y el procedimiento formal de recuperación se completarán en la versión 1.0.
