# Base central y sincronización offline

## Estado del bloque

La infraestructura de sincronización está incorporada, pero permanece **desactivada por defecto**. La aplicación continúa funcionando con el almacenamiento local actual cuando no existen variables de entorno válidas.

No se ha conectado esta rama a `isivoltpro-demo-madrid` ni se ha creado un proyecto Supabase nuevo.

El bloque se valida de forma independiente en el PR #50 antes de incorporarlo a la vista previa pública.

## Arquitectura

- GitHub Pages sirve el frontend estático.
- Supabase/PostgreSQL será la fuente central de verdad.
- `localStorage` mantiene una caché operativa en cada navegador.
- Una cola de salida conserva los cambios realizados sin conexión.
- Los movimientos usan `operationId` e índices únicos para impedir duplicados.
- `sync_events` entrega cambios incrementales mediante un cursor numérico.
- Los cambios remotos no sobrescriben silenciosamente una entidad que tenga una modificación local pendiente: se crea un conflicto para revisión.

## Indicador visible

La cabecera puede mostrar:

- **Solo local**: no existe configuración central.
- **Servidor preparado**: configuración válida, pendiente de sesión.
- **Acceso pendiente**: el usuario debe autenticarse.
- **Sin conexión**: la cola queda protegida localmente.
- **Sincronizando**: subida o descarga en curso.
- **Sincronizado**: cola vacía y cambios remotos aplicados.
- **Revisión necesaria**: existe al menos un conflicto.
- **Error de sincronización**: se aplicará reintento con espera exponencial.

## Migración SQL

La migración inicial está en:

`supabase/migrations/202607230001_central_sync_foundation.sql`

Incluye:

- Espacios de trabajo y miembros.
- Roles Administrador, Almacén, Técnico y Consulta.
- Técnicos, herramientas, accesorios, dispositivos y mantenimiento.
- Movimientos y comprobaciones de accesorios.
- Eventos incrementales y auditoría.
- Movimientos inmutables.
- Row Level Security en todas las tablas expuestas.
- Políticas separadas por espacio de trabajo.
- Ausencia de permisos anónimos sobre los datos operativos.

## Variables de entorno

Copia `.env.example` y completa solamente:

```env
VITE_SUPABASE_URL=https://PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_ISIVOLT_WORKSPACE_ID=UUID_DEL_ESPACIO
```

La clave publicable puede aparecer en el navegador porque su acceso queda limitado por autenticación y RLS. Nunca debe incluirse una clave secreta, `service_role`, contraseña de base de datos ni token administrativo.

## Puesta en marcha prevista

1. Crear un proyecto Supabase exclusivo para Herramientas QR.
2. Aplicar la migración SQL.
3. Revisar asesores de seguridad y rendimiento.
4. Crear el primer usuario mediante Supabase Auth.
5. Crear un espacio de trabajo con ese usuario como `created_by`.
6. Copiar el UUID del espacio a `VITE_ISIVOLT_WORKSPACE_ID`.
7. Configurar las variables como secretos/variables del despliegue.
8. Probar con inventario de demostración antes de migrar datos reales.
9. Crear usuarios y relacionarlos con técnicos.
10. Validar dos dispositivos, trabajo sin conexión, reconexión e idempotencia.

## Fotografías

Las imágenes todavía no se sincronizan. `imageDataUrl` se mantiene únicamente en la caché local y las URI nativas continúan reservadas para Android. Las fotografías centrales requerirán un bucket privado de Storage y políticas propias en un bloque posterior.

## Conflictos

Cuando un dispositivo tiene una herramienta modificada y recibe un cambio remoto de la misma herramienta:

1. Se conserva la copia local pendiente.
2. Se guarda el evento remoto completo.
3. El indicador cambia a **Revisión necesaria**.
4. No se avanza el cambio sobre esa entidad hasta resolverlo expresamente.

Los movimientos no se editan ni se resuelven mediante sobrescritura. Las correcciones se registran como nuevos movimientos de ajuste enlazados.

## Seguridad

- El frontend usa únicamente clave publicable.
- Todas las operaciones requieren usuario autenticado.
- La RLS limita el acceso al espacio de trabajo del usuario.
- Los técnicos pueden consultar inventario y registrar movimientos, pero la gestión estructural queda reservada a Administrador y Almacén.
- La auditoría completa solo es visible para Administrador y Almacén.
