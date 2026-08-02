# Respuesta premium del escáner

## Objetivo

Dar una confirmación inmediata y diferenciada después de cada lectura sin depender únicamente de un mensaje de texto.

## Respuestas

- **Correcta:** destello verde, check, tono agudo y vibración breve.
- **Advertencia:** destello naranja, tono intermedio y vibración doble.
- **Error:** destello rojo, tono grave y vibración de error.
- **Operación finalizada:** confirmación azul, tono ascendente y patrón háptico final.

La capa observa los mensajes y el contador de la sesión existente. No modifica la validación ni el registro por lotes.

## Preferencias

Desde el icono de ajustes de la ventana de escaneo se pueden activar o desactivar:

- sonido;
- vibración;
- animaciones intensas.

Las preferencias se guardan localmente en el dispositivo. La interfaz respeta también `prefers-reduced-motion`.

## Compatibilidad

El sonido utiliza Web Audio y se inicia a partir de la interacción de la sesión. La vibración depende de la compatibilidad del navegador y nunca sustituye la confirmación visual y textual.
