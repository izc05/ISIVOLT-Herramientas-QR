# ISIVOLT Herramientas QR — servidor central local

Este directorio convierte un mini PC Ubuntu vacío en el servidor central de la aplicación sin cuotas mensuales.

## Componentes

- **PocketBase**: autenticación, API, SQLite y panel administrativo.
- **Aplicación web**: se compila y copia dentro de `pb_public`.
- **Station service**: QR firmado, rotatorio y canje único para operaciones presenciales.
- **Caddy**: una única dirección HTTPS dentro de la red.
- **systemd**: arranque automático y recuperación tras fallo.
- **Copias**: archivo diario cifrable/transportable con retención local.

## Requisitos

- Ubuntu 22.04 o 24.04.
- Arquitectura amd64 o arm64.
- Acceso `sudo` durante la instalación.
- Red cableada recomendada para el mini PC.
- Wi‑Fi del mini PC o punto de acceso independiente para los teléfonos.

## Instalación inicial

Desde una copia del repositorio:

```bash
cd pocketbase-server/deploy
chmod +x install-ubuntu.sh deploy-web.sh backup-isivolt-pocketbase.sh
sudo ./install-ubuntu.sh
```

El instalador:

1. solicita el correo del administrador;
2. genera una contraseña inicial si no se proporciona;
3. crea el usuario de servicio `isivolt`;
4. descarga la versión fijada de PocketBase;
5. aplica las migraciones desde una base vacía;
6. crea el administrador inicial;
7. activa PocketBase y las copias con `systemd`;
8. elimina la contraseña de arranque del archivo de entorno tras crear la cuenta.

La contraseña generada aparece una sola vez en la terminal. Debe guardarse en un gestor de contraseñas o en la custodia administrativa definida para el almacén.

## Comprobaciones

```bash
systemctl status isivolt-pocketbase
curl http://127.0.0.1:8090/api/isivolt/health
systemctl list-timers isivolt-pocketbase-backup.timer
journalctl -u isivolt-pocketbase -n 100 --no-pager
```

## Desplegar la aplicación web

Desde la raíz del repositorio:

```bash
ISIVOLT_WORKSPACE=ISIVOLT ./pocketbase-server/deploy/deploy-web.sh
```

En producción, la web usa:

```text
VITE_POCKETBASE_URL=same-origin
```

Por tanto, navegador, API y autenticación utilizan la misma dirección HTTPS y no necesitan una clave de administrador en el frontend.

## HTTPS local

El archivo `deploy/Caddyfile.example` propone:

```text
https://almacen.isivolt.local
```

Caddy puede emitir una CA local mediante `tls internal`. Los móviles del piloto deben confiar una sola vez en esa CA. Sin un certificado reconocido, los navegadores pueden bloquear cámara, sesión o canje presencial.

La ruta recomendada es:

- `/` y `/api/*` → PocketBase;
- `/station/*` → servicio de QR presencial.

## Copias

La copia automática se ejecuta diariamente y conserva 14 días por defecto:

```text
/var/backups/isivolt-pocketbase/
```

Prueba manual:

```bash
sudo /usr/local/sbin/backup-isivolt-pocketbase
```

Una copia no se considera válida hasta haber realizado una restauración de prueba en otro directorio o equipo.

## Directorios del sistema

```text
/opt/isivolt-pocketbase/          binario, hooks, migraciones y web
/var/lib/isivolt-pocketbase/      base de datos y datos operativos
/var/backups/isivolt-pocketbase/  copias diarias
/etc/isivolt-pocketbase.env       configuración protegida
```

## Seguridad

- PocketBase escucha solo en `127.0.0.1:8090`.
- Caddy es el único servicio expuesto a la red.
- Las colecciones no aceptan escrituras directas desde móviles.
- Los movimientos pasan por la API autoritativa.
- El rol Técnico queda vinculado a su propia ficha.
- `operationId` evita duplicados por reintento o doble pulsación.
- El modo presencial puede exigir QR firmado y nonce de un solo uso.
- La aplicación web nunca recibe la contraseña de administrador del servidor.

## Puesta en producción gradual

1. Instalar y verificar PocketBase sin datos reales.
2. Crear dos usuarios de prueba.
3. Cargar dos herramientas ficticias.
4. Probar préstamo y devolución desde dos teléfonos.
5. Encender la validación presencial.
6. Probar reinicio, pérdida de red y recuperación.
7. Crear y restaurar una copia.
8. Importar el inventario real.

No debe importarse inventario real antes de completar los siete primeros pasos.
