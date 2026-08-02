# Catálogos y ubicaciones IsiVoltPro

## Objetivo

Eliminar variaciones de texto libre y utilizar identificadores estables para categorías de material, especialidades de técnicos y ubicaciones.

## Catálogos

Cada registro contiene nombre, código, color, icono opcional, estado activo y fechas de creación/actualización.

- Las categorías de material se vinculan mediante `Tool.categoryId`.
- Las especialidades se vinculan mediante `Technician.categoryId`.
- El nombre visible se conserva también en la ficha para compatibilidad y exportación.
- Renombrar un catálogo actualiza el texto visible sin cambiar su identificador.
- Un catálogo utilizado no puede desactivarse.

## Ubicaciones

Las ubicaciones se vinculan mediante `Tool.locationId` y pueden depender de otra ubicación mediante `parentId`.

Ejemplo:

```text
Hospital
└── Edificio principal
    └── Planta -1
        └── Almacén eléctrico
```

No se permite asignar como padre la propia ubicación ni uno de sus descendientes. Una ubicación con herramientas o ubicaciones hijas activas no puede desactivarse.

## Importación CSV

La importación busca categorías y ubicaciones sin distinguir mayúsculas/minúsculas. Cuando no existen, las crea automáticamente y vincula los artículos mediante sus nuevos identificadores.

## PocketBase

Colecciones:

- `isivolt_tool_categories`
- `isivolt_technician_categories`
- `isivolt_locations`

Administrador y coordinador pueden mantenerlas. Las cuentas técnicas pueden consultarlas, pero no crearlas, modificarlas ni eliminarlas.

## Compatibilidad

Los campos de texto `category` y `location` continúan presentes durante la transición. El identificador estable es la referencia principal y permite renombrar sin romper herramientas, técnicos o historial.
