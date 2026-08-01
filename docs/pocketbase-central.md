# PocketBase central para IsiVoltPro Herramientas

## Objetivo

Compartir técnicos, herramientas, préstamos, devoluciones, lotes e historial entre el administrador y los móviles de los técnicos.

La aplicación conserva una copia local para poder seguir trabajando durante una pérdida temporal de conexión. Cuando vuelve la red, combina los registros locales y remotos y sincroniza los cambios.

## Arquitectura

- **Frontend:** GitHub Pages y PWA instalable.
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

5. Entrar en el panel de administración y crear el primer registro en `isivolt_users`:

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

El túnel publicará PocketBase con un hostname HTTPS, por ejemplo:

```text
https://datos.tudominio.es
```

El servicio de origen será:

```text
http://127.0.0.1:8090
```

No es necesario abrir el puerto 8090 en el router.

## Configuración de la web

Puede definirse `VITE_POCKETBASE_URL` al compilar o introducir la dirección desde el indicador de nube de la aplicación. La dirección y el token se guardan únicamente en el navegador del dispositivo.

## Sincronización

### Técnicos y herramientas

Se sincronizan por `external_id`. Cuando el registro existe en ambos lados, se conserva el que tenga el `source_updated` más reciente.

### Lotes y movimientos

Son registros inmutables. Solo se crean si su `external_id` todavía no existe en el servidor.

Cada operación conserva técnico, métodos de identificación y escaneo, artículos, inicio, final y `batchId` común.

## Funcionamiento sin conexión

Si PocketBase no responde, la aplicación sigue guardando en local. Al recuperar conexión se puede pulsar **Sincronizar ahora**.

## Prueba recomendada

1. Crear un administrador en PocketBase.
2. Conectar un navegador de escritorio.
3. Crear técnico y herramienta.
4. Conectar un móvil con el mismo `workspace`.
5. Comprobar sincronización y ejecutar un préstamo por lotes.
6. Confirmar estado, lote e historial desde el otro dispositivo.
