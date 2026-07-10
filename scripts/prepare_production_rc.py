#!/usr/bin/env python3
"""Prepara de forma idempotente la candidata de producción 1.0.0-rc.1."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "1.0.0-rc.1"

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = VERSION
package_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

config_path = ROOT / "src/config/app.ts"
config = config_path.read_text(encoding="utf-8")
config = re.sub(r"export const APP_VERSION = '[^']+';", f"export const APP_VERSION = '{VERSION}';", config)
config_path.write_text(config, encoding="utf-8")

index_path = ROOT / "index.html"
index = index_path.read_text(encoding="utf-8")
main_script = '    <script type="module" src="/src/main.tsx"></script>'
production_scripts = [
    '    <script type="module" src="/src/features/management/maintenanceBootstrap.tsx"></script>',
    '    <script type="module" src="/src/production/bootstrap.tsx"></script>',
]
for script in production_scripts:
    if script not in index:
        if main_script not in index:
            raise RuntimeError("No se ha encontrado el script principal en index.html")
        index = index.replace(main_script, f"{script}\n{main_script}", 1)
index_path.write_text(index, encoding="utf-8")

readme_path = ROOT / "README.md"
readme = readme_path.read_text(encoding="utf-8")
readme = re.sub(r"## Estado actual — [^\n]+", f"## Estado actual — {VERSION}", readme)
notice = """
## Candidata de producción

La rama 1.0 incorpora icono y splash definitivos, versionado Android, comprobaciones de puesta en servicio y automatización para APK/AAB release. La versión continuará identificada como `1.0.0-rc.1` hasta completar la firma privada y el piloto físico descrito en `docs/PRODUCTION.md` y `docs/PILOT_CHECKLIST.md`.
"""
if "## Candidata de producción" not in readme:
    marker = "## Tecnología"
    readme = readme.replace(marker, notice + "\n" + marker, 1)
readme_path.write_text(readme, encoding="utf-8")

print(f"Candidata {VERSION} preparada.")
