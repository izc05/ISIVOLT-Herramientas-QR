#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'index.html'
content = path.read_text(encoding='utf-8')
script = '    <script type="module" src="/src/security/rectificationBootstrap.tsx"></script>'
main = '    <script type="module" src="/src/main.tsx"></script>'
if script not in content:
    if main not in content:
        raise RuntimeError('No se ha encontrado el script principal en index.html')
    content = content.replace(main, f'{script}\n{main}', 1)
    path.write_text(content, encoding='utf-8')
print('Integración de rectificaciones aplicada.')
