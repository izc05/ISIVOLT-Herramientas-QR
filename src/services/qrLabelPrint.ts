import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const buildPrintDocument = (title: string, cardsHtml: string[]) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box}body{margin:0;padding:12mm;font-family:Arial,sans-serif;color:#081526;background:#fff}
  h1{margin:0 0 8mm;font-size:16pt}.sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8mm 6mm}
  .qr-label-card{position:relative;display:grid;grid-template-columns:34mm minmax(0,1fr);gap:5mm;align-items:center;min-height:45mm;padding:5mm;border:1px solid #b9c8d7;border-radius:5mm;break-inside:avoid;background:#fff}
  .qr-label-code svg{display:block;width:32mm!important;height:32mm!important}.qr-label-copy{display:grid;gap:2mm;min-width:0}
  .qr-label-copy span{color:#1d7da8;font-size:8pt;font-weight:700;letter-spacing:.14em}.qr-label-copy strong{font-size:12pt;line-height:1.15;overflow-wrap:anywhere}
  .qr-label-copy small{color:#52677a;font-size:9pt}.qr-label-copy b{width:max-content;padding:2mm 3mm;border-radius:2mm;color:#fff;background:#071d33;font-size:9pt;letter-spacing:.08em}
  .no-print,.qr-label-select,.qr-label-print-one{display:none!important}
  @page{size:A4;margin:8mm}@media(max-width:700px){body{padding:6mm}.sheet{grid-template-columns:1fr}}
</style>
</head>
<body><h1>${escapeHtml(title)}</h1><main class="sheet">${cardsHtml.join('')}</main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script></body>
</html>`;

const downloadHtml = (filename: string, html: string) => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const printOrShareQrLabels = async (
  title: string,
  cardsHtml: string[],
  filename = 'ISIVOLT_etiquetas_QR.html',
): Promise<'shared' | 'printed' | 'downloaded'> => {
  if (cardsHtml.length === 0) throw new Error('No hay etiquetas seleccionadas.');
  const html = buildPrintDocument(title, cardsHtml);

  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: filename,
      data: html,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({
      title,
      text: 'Abre este archivo y selecciona Imprimir para obtener las etiquetas QR.',
      files: [result.uri],
      dialogTitle: 'Imprimir etiquetas QR',
    });
    return 'shared';
  }

  const popup = window.open('', '_blank');
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    return 'printed';
  }

  downloadHtml(filename, html);
  return 'downloaded';
};
