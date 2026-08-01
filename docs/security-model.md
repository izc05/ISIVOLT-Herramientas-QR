# Modelo de seguridad de IsiVoltPro Herramientas

## Capas

IsiVoltPro aplica dos capas diferentes:

1. **Interfaz por rol:** oculta acciones que no corresponden al usuario.
2. **Reglas PocketBase:** autorizan o rechazan realmente cada lectura y escritura.

Ocultar un botón nunca se considera una medida de seguridad suficiente. Las reglas del servidor son la autoridad final.

## Espacio de trabajo

Todos los registros centrales incorporan `workspace`.

Una cuenta solo puede consultar o modificar registros cuyo espacio coincida con `@request.auth.workspace`. El campo `workspace` no puede cambiarse mediante una actualización ordinaria.

## Administrador

Puede:

- consultar todo su espacio;
- crear, editar y desactivar técnicos;
- crear, editar y retirar artículos;
- registrar préstamos y devoluciones;
- sincronizar lotes y movimientos;
- eliminar técnicos o artículos cuando la regla y el flujo operativo lo permitan.

No puede cambiar mediante una actualización normal el `workspace` ni el `external_id` de un registro.

## Coordinador

Tiene permisos operativos equivalentes sobre técnicos e inventario, pero la interfaz oculta la configuración destructiva local.

## Técnico

Solo puede consultar:

- su propia ficha de técnico;
- artículos disponibles;
- artículos prestados a su propia ficha;
- sus propios lotes;
- sus propios movimientos.

Solo puede modificar un artículo en dos transiciones:

```text
Disponible → Prestado a su propio technician_external_id
Prestado a él → Disponible y sin technician_external_id
```

Durante esas transiciones no puede cambiar:

- código;
- nombre;
- categoría;
- ubicación;
- marca;
- modelo;
- serie;
- QR;
- NFC;
- fecha de creación;
- espacio de trabajo;
- identificador externo.

Los lotes creados por un técnico deben usar:

```text
operator_mode = self-service
identification_method = authenticated
technician_external_id = técnico vinculado a la cuenta
```

Los movimientos creados por un técnico:

- solo pueden ser `loan` o `return`;
- deben pertenecer a su ficha;
- deben indicar identificación `authenticated`;
- deben estar asociados a un lote.

## Registros inmutables

Los lotes y movimientos no pueden editarse ni borrarse mediante cuentas normales. Esto protege la auditoría histórica.

## Superusuario PocketBase

El superusuario ignora las reglas de API. Debe reservarse para:

- migraciones;
- recuperación;
- creación inicial de cuentas;
- mantenimiento administrativo excepcional.

Las credenciales de superusuario no deben guardarse en GitHub ni introducirse en la aplicación cliente.

## Dispositivos compartidos

Cerrar sesión elimina el token y el perfil, pero la versión actual conserva una caché local operativa. Antes del piloto multiusuario se debe validar el comportamiento de dispositivos compartidos y, cuando sea necesario, separar o limpiar la caché por `workspace` y cuenta.

## Migraciones

- `1722512100_isivoltpro_core.js`: crea las colecciones.
- `1722512200_harden_isivolt_access.js`: aplica las reglas endurecidas.

Ambas se ejecutarán en orden mediante:

```bash
./pocketbase migrate up
```
