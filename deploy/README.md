# Despliegue de IsiVoltPro Central

Este directorio prepara PocketBase para el mini PC Ubuntu sin exponer el puerto 8090 directamente a Internet.

## Arquitectura

```text
GitHub Pages (frontend)
        ↓ HTTPS
Cloudflare Tunnel
        ↓ 127.0.0.1:8090
PocketBase + migraciones IsiVoltPro
        ↓
/var/lib/isivoltpro-pocketbase/pb_data
```

PocketBase solo escucha en la interfaz local. El acceso exterior debe realizarse mediante Cloudflare Tunnel.

## Requisitos

- Ubuntu o Debian de 64 bits;
- arquitectura x86_64 o ARM64;
- acceso root mediante `sudo`;
- conexión a Internet durante la instalación;
- repositorio descargado en el mini PC.

## Instalación

Desde la raíz del repositorio:

```bash
sudo bash deploy/pocketbase/install.sh
```

La versión predeterminada puede cambiarse:

```bash
sudo PB_VERSION=0.39.9 bash deploy/pocketbase/install.sh
```

El instalador:

1. crea el usuario de sistema `isivoltpro`;
2. descarga el binario oficial según la arquitectura;
3. instala las migraciones del repositorio;
4. crea un servicio systemd endurecido;
5. inicia PocketBase en `127.0.0.1:8090`;
6. activa una copia diaria con 14 días de retención;
7. comprueba `/api/health`.

## Supercuenta inicial

```bash
sudo /opt/isivoltpro-pocketbase/create-admin.sh
```

El asistente solicita correo y contraseña sin guardarlos en el repositorio ni en archivos temporales.

Después entra en el panel PocketBase y crea el primer registro de `isivolt_users`:

```text
role: admin
workspace: principal
active: true
```

La cuenta de la aplicación es diferente de la supercuenta de PocketBase.

## Cloudflare Tunnel

1. Crea un túnel y una ruta DNS para un subdominio como `datos.tudominio.es`.
2. Copia `deploy/cloudflare/config.yml.example` a `/etc/cloudflared/config.yml`.
3. Sustituye el UUID, el archivo de credenciales y el dominio.
4. Inicia o reinicia `cloudflared`.

No publiques el panel mediante una regla abierta. Limita el acceso administrativo mediante Cloudflare Access, VPN o un túnel SSH.

## Comprobación

Local:

```bash
sudo bash deploy/check-deployment.sh
```

Local y público:

```bash
sudo PUBLIC_URL=https://datos.tudominio.es bash deploy/check-deployment.sh
```

## Configurar la aplicación

En IsiVoltPro abre **Nube** e introduce:

```text
https://datos.tudominio.es
```

Después inicia sesión con la cuenta administradora de `isivolt_users` y sincroniza.

## Copias de seguridad

Estado del temporizador:

```bash
systemctl list-timers isivoltpro-pocketbase-backup.timer
```

Copia manual:

```bash
sudo /opt/isivoltpro-pocketbase/backup.sh
```

Archivos:

```text
/var/lib/isivoltpro-pocketbase/backups/
```

La copia detiene PocketBase durante unos segundos para obtener un archivo coherente y vuelve a iniciar el servicio automáticamente.

## Actualización

Vuelve a descargar el repositorio y ejecuta de nuevo el instalador con la versión deseada. El instalador sustituye el binario y las migraciones, pero conserva `pb_data` y las copias.

Antes de actualizar:

```bash
sudo /opt/isivoltpro-pocketbase/backup.sh
```

## Diagnóstico

```bash
systemctl status isivoltpro-pocketbase
journalctl -u isivoltpro-pocketbase -n 100 --no-pager
curl http://127.0.0.1:8090/api/health
```

Desde la aplicación también puede utilizarse el panel **Sistema** para probar la URL pública de PocketBase.
