# PocketBase central para IsiVoltPro Herramientas

## Objetivo

Compartir técnicos, herramientas, préstamos, devoluciones, lotes e historial entre el administrador y los móviles de los técnicos.

La aplicación conserva una copia local para poder seguir trabajando durante una pérdida temporal de conexión. Cuando vuelve la red, combina los registros locales y remotos y sincroniza los cambios.

## Arquitectura

- **Frontend:** GitHub Pages.
- **Backend:** PocketBase en el mini PC Ubuntu.
- **Acceso exterior:** Cloudflare Tunnel con HTTPS.
- **Autenticación:** colección `isivolt_users`.
- **Separación de clientes/centros:** campo `workspace`.

## Colecciones

La migración `pb_migrations/1722512100_isivoltpro_core.js` crea:

- `isivolt_users`: cuentas y roles.
- `isivolt_technicians`: técnicos y credenciales QR/NFC.
- `isivolt_tools`: herramientas y material inventariable.
- `isivolt_batches`: operaciones por lotes.
- `isivolt_movements`: auditoría inmutable de cada artículo.

## Roles

- `admin`: administración general.
- `coordinator`: alta y edición operativa de técnicos y material.
- `technician`: autoservicio, préstamos, devoluciones y consulta del espacio asignado.

Los usuarios solo pueden leer registros cuyo `workspace` coincide con el de su cuenta.

## Instalación en el mini PC

1. Copiar la carpeta `pb_migrations` junto al ejecutable de PocketBase.
2. Detener PocketBase antes de modificar la instalación.
3. Aplicar las migraciones:

```bash
./pocketbase migrate up
```

4. Iniciar PocketBase escuchando solo en la máquina local:

```bash
./pocketbase serve --http=127.0.0.1:8090
```

5. Entrar en el panel de administración de PocketBase y crear el primer registro en `isivolt_users`:

```text
email: correo del administrador
password: contraseña segura
passwordConfirm: la misma contraseña
display_name: nombre visible
role: admin
workspace: principal
active: true
```

No se deben guardar contraseñas, tokens ni copias de `pb_data` en GitHub.

## Cloudflare Tunnel

El túnel debe publicar PocketBase con un hostname HTTPS, por ejemplo:

```text
https://datos.tudominio.es
```

El servicio de origen del túnel será:

```text
http://127.0.0.1:8090
```

No es necesario abrir el puerto 8090 en el router.

## Configuración de la web

Hay dos posibilidades:

### Configuración durante la compilación

Crear una variable:

```text
VITE_POCKETBASE_URL=https://datos.tudominio.es
```

### Configuración desde la aplicación

Pulsar el indicador `Solo local` o `Revisar nube` de la cabecera e introducir:

- Dirección HTTPS del servidor.
- Correo.
- Contraseña.

La dirección y el token se guardan únicamente en el navegador del dispositivo.

## Sincronización

### Técnicos y herramientas

Se sincronizan por `external_id`. Cuando el registro existe en ambos lados, se conserva el que tenga el `source_updated` más reciente.

### Lotes y movimientos

Son registros inmutables. Solo se crean si su `external_id` todavía no existe en el servidor.

Cada préstamo o devolución por lotes conserva:

- Técnico identificado.
- Método de identificación.
- Artículos escaneados.
- Método de escaneo.
- Inicio y final de la operación.
- `batchId` común en los movimientos.

## Funcionamiento sin conexión

Si PocketBase no responde:

- La aplicación sigue guardando en local.
- El indicador cambia a `Sin conexión`.
- El usuario puede continuar trabajando.
- Al recuperar la conexión se puede pulsar `Sincronizar ahora`.

## Limitaciones de esta primera fase

- El borrado central no se ejecuta automáticamente desde el botón de vaciado local.
- La creación de cuentas se realiza inicialmente desde PocketBase.
- Las invitaciones, recuperación de contraseña y gestión de usuarios se incorporarán en una fase posterior.
- Los conflictos sobre la misma herramienta se resuelven con la fecha de actualización más reciente; la auditoría de movimientos no se sobrescribe.

## Prueba recomendada

1. Crear un administrador en PocketBase.
2. Conectar un navegador de escritorio.
3. Crear un técnico y una herramienta.
4. Comprobar que aparecen en PocketBase.
5. Conectar un segundo móvil con el mismo `workspace`.
6. Sincronizar y comprobar que recibe los registros.
7. Ejecutar un préstamo por lotes desde un dispositivo.
8. Sincronizar el otro dispositivo y confirmar estado, lote e historial.
