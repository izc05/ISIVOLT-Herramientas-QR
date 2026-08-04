import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const replaceExact = (path, search, replacement) => {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(search)) throw new Error(`${path}: no se encontró el bloque esperado`);
  writeFileSync(path, source.replace(search, replacement));
};

replaceExact(
  'src/App.tsx',
  "  linkToolNfc,\n} from './data/workspaceTransactions';",
  "  linkToolNfc,\n  technicianCanReceiveTools,\n} from './data/workspaceTransactions';",
);

replaceExact(
  'src/App.tsx',
  "  const activeTechnicians = data.technicians.filter((technician) => technician.active);",
  "  const activeTechnicians = data.technicians.filter(technicianCanReceiveTools);",
);

replaceExact(
  'src/App.tsx',
  "    const currentTool = data.tools.find((item) => item.id === selectedToolId);",
  "    const currentTool = loadData().tools.find((item) => item.id === selectedToolId);",
);

replaceExact(
  'src/App.tsx',
  `  const saveNfc = async (writeToTag: boolean) => {
    if (!selectedTool || !nfcTag.trim()) return;
    let writeWarning = '';
    if (writeToTag) {
      const Reader = (window as unknown as { NDEFReader?: new () => { write(data: unknown): Promise<void> } }).NDEFReader;
      if (!Reader) {
        writeWarning = 'Web NFC no está disponible;';
      } else {
        try {
          const reader = new Reader();
          await reader.write({ records: [{ recordType: 'text', data: selectedTool.qrPayload }] });
        } catch {
          writeWarning = 'No se pudo grabar físicamente la etiqueta;';
        }
      }
    }
    const result = await linkToolNfc(selectedTool.id, nfcTag);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    setNotice(writeWarning
      ? \`${'${writeWarning}'} la referencia se guardó sin duplicados.\`
      : 'NFC vinculado a la herramienta.');
  };
`,
  `  const saveNfc = async (writeToTag: boolean) => {
    if (!selectedTool || !nfcTag.trim()) return;
    const result = await linkToolNfc(selectedTool.id, nfcTag);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }

    let writeWarning = '';
    if (writeToTag) {
      const Reader = (window as unknown as { NDEFReader?: new () => { write(data: unknown): Promise<void> } }).NDEFReader;
      if (!Reader) {
        writeWarning = 'Web NFC no está disponible;';
      } else {
        try {
          const reader = new Reader();
          await reader.write({ records: [{ recordType: 'text', data: result.value.qrPayload }] });
        } catch {
          writeWarning = 'No se pudo grabar físicamente la etiqueta;';
        }
      }
    }

    closeModal();
    setNotice(writeWarning
      ? \`${'${writeWarning}'} la referencia ya está vinculada sin duplicados.\`
      : 'NFC vinculado a la herramienta.');
  };
`,
);

replaceExact(
  'src/scan/ScanSession.tsx',
  "import { createQuickToolRecord, commitBatchOperation } from '../data/workspaceTransactions';",
  "import { commitBatchOperation, createQuickToolRecord, technicianCanReceiveTools } from '../data/workspaceTransactions';",
);

replaceExact(
  'src/scan/ScanSession.tsx',
  "  const activeTechnicians = useMemo(() => data.technicians.filter((technician) => technician.active), [data.technicians]);",
  "  const activeTechnicians = useMemo(\n    () => data.technicians.filter((technician) => operation === 'loan' ? technicianCanReceiveTools(technician) : true),\n    [data.technicians, operation],\n  );",
);

replaceExact(
  'src/scan/ScanSession.tsx',
  "    const technician = snapshot.technicians.find((item) => item.id === draft.technicianId && item.active);",
  "    const technician = snapshot.technicians.find((item) => (\n      item.id === draft.technicianId\n      && (draft.operation === 'return' || technicianCanReceiveTools(item))\n    ));",
);

replaceExact(
  'scripts/validate-data-consistency.mjs',
  "  'technicianIsOperational',",
  "  'technicianCanReceiveTools',",
);

replaceExact(
  'scripts/validate-data-consistency.mjs',
  "  'duplicateTechnician',\n]) {",
  "  'duplicateTechnician',\n  \"input.operation === 'loan' && !technicianCanReceiveTools(technician)\",\n]) {",
);

rmSync('scripts/apply-alpha-7-11-review-fixes.mjs');
console.log('Ajustes finales alpha.7.11 aplicados.');
