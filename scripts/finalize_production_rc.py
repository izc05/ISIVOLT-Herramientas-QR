#!/usr/bin/env python3
"""Finaliza de forma idempotente la candidata 1.0.0-rc.1."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "1.0.0-rc.1"

subprocess.run(["python3", "scripts/prepare_production_rc.py"], cwd=ROOT, check=True)

lock_path = ROOT / "package-lock.json"
if lock_path.exists():
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    lock["version"] = VERSION
    packages = lock.get("packages")
    if isinstance(packages, dict) and isinstance(packages.get(""), dict):
        packages[""]["version"] = VERSION
    lock_path.write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

for workflow_name in ["production-readiness.yml", "build-release.yml"]:
    path = ROOT / ".github/workflows" / workflow_name
    content = path.read_text(encoding="utf-8")
    content = content.replace("npx --yes @capacitor/assets generate --android --assetPath assets", "npx --yes @capacitor/assets generate --android")
    path.write_text(content, encoding="utf-8")

roadmap_path = ROOT / "docs/ROADMAP.md"
roadmap = roadmap_path.read_text(encoding="utf-8")
roadmap = roadmap.replace(
    "- [ ] Pruebas unitarias, integración y flujos completos.",
    "- [x] Pruebas unitarias, integración y flujo completo candidato.",
)
roadmap = roadmap.replace(
    "- [ ] Icono y splash definitivos.",
    "- [x] Icono y splash candidatos de producción.",
)
roadmap = roadmap.replace(
    "- [ ] VersionCode y versionName automáticos.",
    "- [x] VersionCode y versionName automáticos.",
)
roadmap = roadmap.replace(
    "- [ ] Manual de usuario y administrador.",
    "- [x] Manual de usuario y administrador.",
)
if "- [x] Centro integrado de puesta en servicio." not in roadmap:
    marker = "- [x] Manual de usuario y administrador."
    roadmap = roadmap.replace(marker, marker + "\n- [x] Centro integrado de puesta en servicio.\n- [x] Workflow de APK/AAB release condicionado a secretos de firma.", 1)
roadmap_path.write_text(roadmap, encoding="utf-8")

production = ROOT / "docs/PRODUCTION.md"
text = production.read_text(encoding="utf-8")
if "## Resultado de automatización" not in text:
    text += """

## Resultado de automatización

La candidata puede generar automáticamente:

- APK debug con iconos y splash.
- APK y AAB release unsigned para comprobar la compilación.
- APK y AAB release firmadas cuando los cuatro secretos de firma están configurados.
- Metadatos con `versionName`, `versionCode`, fecha y estado de firma.

La ausencia de secretos no se interpreta como una versión firmada: el workflow etiqueta el artefacto como validación unsigned.
"""
production.write_text(text, encoding="utf-8")

print(f"Candidata {VERSION} finalizada y coherente.")
