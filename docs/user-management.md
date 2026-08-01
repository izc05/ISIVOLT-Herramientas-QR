# Gestión de cuentas IsiVoltPro

## Cuenta administradora inicial

La primera cuenta administradora se crea desde el panel de PocketBase después de aplicar las migraciones.

Debe usar:

```text
role: admin
workspace: principal
active: true
```

La aplicación no permite crear ni promover otra cuenta al rol `admin`. Esta protección evita una escalada accidental desde el frontend.

## Cuentas que puede crear el administrador

### Coordinador

- acceso operativo al inventario y técnicos;
- puede registrar préstamos y devoluciones;
- no necesita una ficha técnica vinculada;
- no puede gestionar usuarios ni crear administradores.

### Técnico

- debe estar vinculado a una ficha de técnico activa;
- una ficha solo puede vincularse a una cuenta dentro del mismo workspace;
- accede a Mi material y al autoservicio autenticado;
- solo consulta y modifica los registros autorizados por las reglas PocketBase.

## Contraseña temporal

Al crear o restablecer una cuenta, IsiVoltPro genera una contraseña aleatoria.

La contraseña:

- se muestra únicamente en la sesión actual del administrador;
- no se guarda en la caché de la aplicación;
- puede copiarse para entregarla por un canal seguro;
- desaparece al cerrar o recargar el panel.

## Desactivación

Desactivar una cuenta impide el inicio de sesión mediante:

```text
authRule = active = true
```

La ficha del técnico, sus préstamos y su historial no se eliminan.

## Eliminación

La aplicación permite eliminar cuentas técnicas o coordinadoras.

No elimina:

- la ficha de técnico;
- herramientas asignadas;
- lotes;
- movimientos históricos.

La cuenta administradora actual y otras cuentas con rol administrador están protegidas contra edición y eliminación desde la aplicación.

## Cambio de rol

Se permiten únicamente:

```text
technician ↔ coordinator
```

Al convertir una cuenta en técnico se exige una ficha vinculada. Al convertirla en coordinador se elimina la vinculación técnica.

## Correo electrónico

El panel no modifica el correo de una cuenta existente. Para corregir un correo erróneo se recomienda eliminar la cuenta operativa y crear otra, conservando la ficha y el historial.

## Reglas del servidor

La migración `1722512300_enable_user_management.js` aplica:

- autenticación solo para cuentas activas;
- creación únicamente por administrador activo del mismo workspace;
- roles creados limitados a técnico y coordinador;
- workspace y correo inmutables mediante el panel;
- protección de administradores;
- gestión de contraseñas solo por administrador autorizado.
