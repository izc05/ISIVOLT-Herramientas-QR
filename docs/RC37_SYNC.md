# RC37 — Sincronización central multiusuario

## Estado

RC37 está desarrollado en dos bloques dependientes:

1. `agent/rc37-transactional-sync` — cola y movimientos transaccionales.
2. `agent/rc37-sync-access-conflicts` — acceso Supabase, cola visible y conflictos.

La sincronización permanece desactivada mientras no existan las tres variables de entorno válidas. No se ha conectado el proyecto `isivoltpro-demo-madrid` ni se han aplicado migraciones a una base de datos real.

## Puesta en marcha QA

1. Crear una rama o proyecto Supabase exclusivo de pruebas.
2. Aplicar por orden:
   - `202607230001_central_sync_foundation.sql`
   - `202607230002_transactional_movements.sql`
   - `202607230003_transactional_movement_guards.sql`
3. Ejecutar asesores de seguridad y rendimiento.
4. Crear dos usuarios Auth de prueba.
5. Crear un workspace y membresías:
   - administrador o almacén;
   - técnico con `technician_id` vinculado.
6. Configurar una compilación de prueba con:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_ISIVOLT_WORKSPACE_ID`
7. Validar préstamo y devolución desde dos sesiones.
8. Reenviar el mismo `operationId` y confirmar idempotencia.
9. Provocar un estado obsoleto y comprobar que la RPC lo rechaza.
10. Probar trabajo offline, reconexión, cola y resolución de conflictos.

## Reglas remotas

- `admin`: gestión completa.
- `warehouse`: inventario, mantenimiento y operaciones.
- `technician`: movimientos únicamente con su ficha vinculada.
- `viewer`: consulta, equivalente al Coordinador local.

El rol remoto y la RLS son la autoridad. El PIN y el rol local mejoran la experiencia del dispositivo, pero nunca sustituyen la validación del servidor.

## Movimiento transaccional

La RPC `apply_tool_movement`:

- comprueba la membresía y el rol;
- exige identidad técnica vinculada cuando corresponde;
- bloquea la herramienta con `FOR UPDATE`;
- valida estado anterior, responsable y accesorios;
- actualiza la herramienta;
- inserta movimiento y comprobaciones;
- usa bloqueo asesor por operación para concurrencia;
- devuelve el resultado existente cuando la operación ya fue aplicada.

Los clientes autenticados no tienen permiso de inserción directa sobre `movements` ni `movement_accessories`.

## Conflictos

Cuando existe un cambio local pendiente y llega un evento remoto de la misma entidad:

- Conservar local mantiene la cola y vuelve a publicar el cambio.
- Aceptar servidor elimina el cambio local y aplica el evento remoto más reciente.
- Los movimientos no se sobrescriben; cualquier corrección se registra mediante rectificación.

## Fotografías

Las fotografías continúan fuera de RC37. Su sincronización requerirá un bucket privado, rutas por workspace y políticas Storage específicas.
