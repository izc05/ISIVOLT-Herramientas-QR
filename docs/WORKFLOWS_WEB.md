# Workflows de la rama web

La rama `agent/rc31-web-preview` sigue una estrategia **web-first**.

## Automatización activa

- `.github/workflows/deploy-pages.yml`: valida pruebas, TypeScript y Vite cuando cambia la rama web.
- `.github/workflows/pages.yml` en `main`: descarga la rama web validada y publica `dist` en GitHub Pages.

## Automatización histórica

Los workflows de integración, seguridad, restauración y candidatas Android se conservan para trazabilidad, pero en la rama web solo pueden iniciarse mediante `workflow_dispatch`.

No deben reaccionar a los commits habituales de `agent/rc31-web-preview`, generar APK ni escribir en ramas RC antiguas durante el desarrollo web.

## Regla para nuevos bloques

Todo bloque web debe pasar:

1. `npm test`.
2. `npm run build`.
3. Publicación real en GitHub Pages.

Las compilaciones Android permanecerán manuales hasta que la versión web multiusuario sea estable.
