# Auditoría de recuperación RC23

## Motivo

La APK entregada para pruebas contiene la versión interna `1.0.0-rc.23-nfc`, mientras que la rama `main` del repositorio continúa en `1.0.0-rc.7`.

La APK funciona como referencia de comportamiento, pero no sustituye al código fuente: los archivos JavaScript están compilados y minificados, por lo que deben reconstruirse las funciones importantes sobre una base mantenible.

## Diferencias confirmadas frente a RC7

La comparación directa entre los paquetes Android RC7 y RC23 confirma que RC23 incorporó un flujo operativo más avanzado.

### Operación guiada

- Nueva operación con elección explícita del tipo.
- Préstamo y devolución de varias herramientas.
- Identificación por técnico o por herramienta.
- Búsqueda manual como alternativa a QR y NFC.
- Pantalla de revisión antes de guardar.
- Acciones `Volver a operación`, `Revisar préstamo` y `Revisar devolución`.
- Confirmación antes de descartar una operación con datos introducidos.

### Préstamos y devoluciones

- Carga de herramientas asignadas a un técnico.
- Filtro para mostrar únicamente sus herramientas prestadas.
- Resolución automática del técnico al identificar una herramienta prestada.
- Condición individual para cada herramienta en una devolución.
- Observación obligatoria para revisión o avería.
- Bloqueo de herramientas en revisión, averiadas o dadas de baja.

### Protección de operaciones

- Estado visible `Guardando operación…`.
- Mensajes diferenciados de préstamo y devolución completados.
- Detección de herramientas repetidas dentro de una operación.
- Mensaje de idempotencia: una operación ya registrada no vuelve a crear movimientos.
- Preparación de todos los movimientos antes de confirmar el lote.

### NFC

- Plugin Android nativo `IsivoltNfcScanner`.
- Identificación de técnicos y herramientas mediante UID NFC.
- Mensajes específicos para NFC desactivado, no compatible, cancelado o no vinculado.
- QR y selección manual mantenidos como alternativas.

### Integridad de datos

RC23 contiene reglas adicionales para:

- aislar movimientos que apuntan a herramientas inexistentes;
- conservar como movimiento de almacén los registros con técnico inexistente;
- rechazar movimientos duplicados;
- cancelar reservas asignadas a técnicos inexistentes;
- devolver a disponible una herramienta prestada sin técnico válido;
- limpiar datos de préstamo incompatibles con el estado actual.

## Funciones que no aparecen en el código fuente RC7

- `operationId` para agrupar e identificar de forma única una operación completa;
- reducer o estado centralizado de la operación;
- confirmación de descarte;
- revisión previa del lote;
- condición de devolución por herramienta;
- motor idempotente de confirmación por lotes;
- flujo RC23 completo de técnico/herramienta mediante QR o NFC.

## Orden de recuperación

1. **Persistencia segura**
   - cola SQLite;
   - marcador de escritura pendiente;
   - recuperación local;
   - bloqueo de doble confirmación.

2. **Dominio operativo RC23**
   - `operationId`;
   - creación atómica del lote;
   - idempotencia;
   - validación previa de todas las herramientas;
   - condición individual por devolución.

3. **Interfaz operativa RC23**
   - seleccionar tipo;
   - identificar técnico o herramienta;
   - añadir múltiples activos;
   - revisar;
   - confirmar;
   - cancelar con aviso.

4. **Utilidad diaria adicional**
   - fecha prevista de devolución;
   - OT y ubicación de uso;
   - checklist de accesorios;
   - transferencia entre técnicos;
   - inventario físico por escaneo;
   - kits de herramientas.

## Regla de seguridad

No debe publicarse ni instalarse como sustitución de RC23 una APK construida desde RC7 hasta recuperar las funciones anteriores y verificar una actualización que conserve los datos.
