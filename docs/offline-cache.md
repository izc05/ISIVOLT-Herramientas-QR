# Caché local y funcionamiento sin conexión

## Contextos separados

IsiVoltPro mantiene copias locales independientes:

```text
Modo local
Cuenta + workspace A
Cuenta + workspace B
Otra cuenta + workspace A
```

La clave de una cuenta incluye tanto el identificador del usuario como el `workspace`. Dos usuarios del mismo centro no comparten directamente la misma caché del navegador.

## Inicio de sesión

### Administrador o coordinador

Cuando la cuenta no tiene todavía caché propia y el modo local contiene datos, IsiVoltPro utiliza esa copia como semilla de la primera sincronización.

Esto permite pasar de la fase de pruebas local al servidor central sin exportar e importar manualmente.

### Técnico

Una cuenta técnica nunca hereda automáticamente la copia del modo local. Empieza con:

- su caché anterior, cuando ya existe; o
- una copia vacía que se completa con los registros autorizados por PocketBase.

Así se evita que un técnico vea datos administrativos que hubieran quedado en el navegador.

## Cierre de sesión

Al cerrar sesión:

1. se elimina el token;
2. se elimina el perfil activo;
3. la interfaz vuelve a la copia del modo local;
4. la caché de la cuenta permanece guardada para el siguiente acceso u operación offline.

Cerrar sesión no borra automáticamente los datos. El borrado debe ser una acción explícita.

## Sesión sin conexión

Cuando una sesión válida ya fue restaurada anteriormente, la cuenta puede continuar usando su caché aunque el servidor no responda. Los cambios se sincronizarán al recuperar conexión.

## Dispositivos compartidos

Para un dispositivo compartido:

- cada trabajador debe cerrar su sesión;
- no debe compartirse la contraseña;
- el navegador conserva copias aisladas por cuenta;
- el modo local debe reservarse para administración o pruebas controladas.

## Claves

La clave local heredada se mantiene para el modo sin cuenta:

```text
isivoltpro-herramientas-v2:data
```

Las cuentas utilizan una clave derivada:

```text
isivoltpro-herramientas-v2:data:cloud:<workspace>:<userId>
```

Los valores se codifican antes de formar la clave.
