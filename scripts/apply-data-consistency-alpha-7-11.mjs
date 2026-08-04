import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content);

const fail = (message) => {
  console.error(`No se pudo aplicar alpha.7.11: ${message}`);
  process.exit(1);
};

const replaceExact = (path, search, replacement) => {
  const source = read(path);
  if (!source.includes(search)) fail(`${path} no contiene el bloque esperado`);
  const next = source.replace(search, replacement);
  if (next === source) fail(`${path} no cambió`);
  write(path, next);
};

const replaceBetween = (path, start, end, replacement) => {
  const source = read(path);
  const startIndex = source.indexOf(start);
  if (startIndex < 0) fail(`${path} no contiene el inicio ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0) fail(`${path} no contiene el final ${end}`);
  write(path, `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`);
};

const transactions = `import { activeStorageKey, loadData, saveData } from '../storage';
import type {
  AppData,
  BatchOperation,
  BatchTransaction,
  IdentificationMethod,
  OperatorMode,
  ScanMethod,
  Technician,
  Tool,
} from '../types';

type WorkspaceLockManager = {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T> | T,
  ): Promise<T>;
};

type WorkspaceNavigator = Navigator & { locks?: WorkspaceLockManager };

type MutationSuccess<T> = { ok: true; data: AppData; value: T };
type MutationFailure = {
  ok: false;
  data: AppData;
  message: string;
  invalidToolIds?: string[];
};
export type WorkspaceTransactionResult<T> = MutationSuccess<T> | MutationFailure;

type MutationDecision<T> =
  | { ok: true; data: AppData; value: T }
  | { ok: false; message: string; invalidToolIds?: string[] };

const uid = (prefix: string) => \`${'${prefix}'}-${'${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}'}\`;
const now = () => new Date().toISOString();

const nextCode = (items: Array<{ code: string }>, prefix: string): string => {
  const highest = items.reduce((max, item) => {
    if (!item.code.startsWith(\`${'${prefix}'}-\`)) return max;
    const number = Number(item.code.split('-').at(-1));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return \`${'${prefix}'}-${'${String(highest + 1).padStart(3, \'0\')}'}\`;
};

const technicianIsOperational = (technician: Technician): boolean => {
  const status = technician.status ?? (technician.active ? 'active' : 'inactive');
  return technician.active && status === 'active';
};

const toolIsLoanable = (tool: Tool): boolean => (
  tool.status === 'available' && (tool.serviceState ?? 'ready') === 'ready'
);

async function mutateWorkspace<T>(
  mutation: (current: AppData) => MutationDecision<T>,
): Promise<WorkspaceTransactionResult<T>> {
  const execute = async (): Promise<WorkspaceTransactionResult<T>> => {
    const current = loadData();
    const decision = mutation(current);
    if (!decision.ok) return { ...decision, data: current };
    saveData(decision.data);
    return decision;
  };

  try {
    const locks = (navigator as WorkspaceNavigator).locks;
    if (locks) {
      return await locks.request(
        \`isivoltpro-workspace:${'${activeStorageKey()}'}\`,
        { mode: 'exclusive' },
        execute,
      );
    }
    return await execute();
  } catch (error) {
    return {
      ok: false,
      data: loadData(),
      message: error instanceof Error
        ? \`No se pudo guardar la operación: ${'${error.message}'}\`
        : 'No se pudo guardar la operación.',
    };
  }
}

export async function createToolRecord(input: {
  name: string;
  category: string;
  location: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  prefix: string;
}): Promise<WorkspaceTransactionResult<Tool>> {
  return mutateWorkspace((current) => {
    const name = input.name.trim();
    if (!name) return { ok: false, message: 'Indica el nombre de la herramienta.' };
    const timestamp = now();
    const code = nextCode(current.tools, input.prefix || 'HER');
    const tool: Tool = {
      id: uid('tool'),
      code,
      name,
      category: input.category.trim() || 'Sin categoría',
      location: input.location.trim() || 'Sin ubicación',
      brand: input.brand?.trim() || undefined,
      model: input.model?.trim() || undefined,
      serialNumber: input.serialNumber?.trim() || undefined,
      kind: 'returnable-tool',
      serviceState: 'ready',
      qrPayload: \`ISIVOLTPRO:TOOL:${'${code}'}\`,
      status: 'available',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const data: AppData = {
      ...current,
      tools: [tool, ...current.tools],
      movements: [{
        id: uid('mov'),
        type: 'tool_created',
        occurredAt: timestamp,
        toolId: tool.id,
        detail: \`${'${tool.name}'} · ${'${tool.code}'}\`,
      }, ...current.movements],
    };
    return { ok: true, data, value: tool };
  });
}

export async function createTechnicianRecord(input: {
  name: string;
  category: string;
  phone?: string;
  email?: string;
}): Promise<WorkspaceTransactionResult<Technician>> {
  return mutateWorkspace((current) => {
    const name = input.name.trim();
    if (!name) return { ok: false, message: 'Indica el nombre del técnico.' };
    const timestamp = now();
    const code = nextCode(current.technicians, 'TEC');
    const technician: Technician = {
      id: uid('tech'),
      code,
      name,
      category: input.category.trim() || 'Sin categoría',
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      status: 'active',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const data: AppData = {
      ...current,
      technicians: [technician, ...current.technicians],
      movements: [{
        id: uid('mov'),
        type: 'technician_created',
        occurredAt: timestamp,
        technicianId: technician.id,
        detail: \`${'${technician.name}'} · ${'${technician.code}'}\`,
      }, ...current.movements],
    };
    return { ok: true, data, value: technician };
  });
}

export async function createQuickToolRecord(input: {
  code: string;
  name: string;
  categoryId: string;
  locationId?: string;
}): Promise<WorkspaceTransactionResult<Tool>> {
  return mutateWorkspace((current) => {
    const code = input.code.trim().toLocaleUpperCase('es-ES');
    const name = input.name.trim();
    const category = (current.toolCategories ?? []).find((entry) => entry.id === input.categoryId && entry.active);
    const location = input.locationId
      ? (current.locations ?? []).find((entry) => entry.id === input.locationId && entry.active)
      : undefined;
    if (!code || !name || !category) {
      return { ok: false, message: 'Código, nombre y categoría activa son obligatorios.' };
    }
    if (input.locationId && !location) {
      return { ok: false, message: 'La ubicación seleccionada ya no está disponible.' };
    }
    if (current.tools.some((tool) => tool.code.toLocaleUpperCase('es-ES') === code)) {
      return { ok: false, message: \`El código ${'${code}'} ya está registrado.\` };
    }
    const timestamp = now();
    const tool: Tool = {
      id: uid('tool'),
      code,
      name,
      category: category.name,
      categoryId: category.id,
      location: location?.name ?? 'Sin ubicación',
      locationId: location?.id,
      kind: 'returnable-tool',
      serviceState: 'ready',
      qrPayload: \`ISIVOLTPRO:TOOL:${'${code}'}\`,
      status: 'available',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const data: AppData = { ...current, tools: [tool, ...current.tools] };
    return { ok: true, data, value: tool };
  });
}

export async function linkToolNfc(
  toolId: string,
  tag: string,
): Promise<WorkspaceTransactionResult<Tool>> {
  return mutateWorkspace((current) => {
    const normalizedTag = tag.trim();
    if (!normalizedTag) return { ok: false, message: 'Indica la referencia de la etiqueta NFC.' };
    const tool = current.tools.find((item) => item.id === toolId);
    if (!tool) return { ok: false, message: 'La herramienta ya no existe.' };
    const comparable = normalizedTag.toLocaleUpperCase('es-ES');
    const duplicateTool = current.tools.find((item) => (
      item.id !== tool.id && item.nfcTag?.trim().toLocaleUpperCase('es-ES') === comparable
    ));
    const duplicateTechnician = current.technicians.find((item) => (
      item.nfcTag?.trim().toLocaleUpperCase('es-ES') === comparable
    ));
    if (duplicateTool || duplicateTechnician) {
      const owner = duplicateTool
        ? \`${'${duplicateTool.code}'} · ${'${duplicateTool.name}'}\`
        : \`${'${duplicateTechnician?.code}'} · ${'${duplicateTechnician?.name}'}\`;
      return { ok: false, message: \`La etiqueta NFC ya está vinculada a ${'${owner}'}.\` };
    }
    const timestamp = now();
    const updated: Tool = { ...tool, nfcTag: normalizedTag, updatedAt: timestamp };
    const data: AppData = {
      ...current,
      tools: current.tools.map((item) => item.id === tool.id ? updated : item),
      movements: [{
        id: uid('mov'),
        type: 'nfc_linked',
        occurredAt: timestamp,
        toolId: tool.id,
        detail: \`${'${tool.name}'} · ${'${normalizedTag}'}\`,
      }, ...current.movements],
    };
    return { ok: true, data, value: updated };
  });
}

export async function commitBatchOperation(input: {
  operation: BatchOperation;
  technicianId: string;
  toolIds: string[];
  operatorMode: OperatorMode;
  identificationMethod: IdentificationMethod;
  scanMethod: ScanMethod;
  startedAt: string;
}): Promise<WorkspaceTransactionResult<BatchTransaction>> {
  return mutateWorkspace((current) => {
    const technician = current.technicians.find((item) => item.id === input.technicianId);
    if (!technician || !technicianIsOperational(technician)) {
      return { ok: false, message: 'El técnico ya no está activo o disponible para recibir material.' };
    }
    const uniqueToolIds = [...new Set(input.toolIds.filter(Boolean))];
    if (uniqueToolIds.length === 0) return { ok: false, message: 'No hay artículos para confirmar.' };

    const toolById = new Map(current.tools.map((tool) => [tool.id, tool]));
    const invalidToolIds = uniqueToolIds.filter((id) => {
      const tool = toolById.get(id);
      if (!tool) return true;
      return input.operation === 'loan'
        ? !toolIsLoanable(tool)
        : tool.status !== 'loaned' || tool.technicianId !== technician.id;
    });
    if (invalidToolIds.length > 0) {
      const labels = invalidToolIds.map((id) => {
        const tool = toolById.get(id);
        return tool ? \`${'${tool.code}'} · ${'${tool.name}'}\` : id;
      });
      return {
        ok: false,
        invalidToolIds,
        message: \`No se ha guardado la operación porque cambió el estado de: ${'${labels.join(\', \')}'} . Revisa el lote.\`,
      };
    }

    const completedAt = now();
    const batchId = uid('batch');
    const selectedTools = uniqueToolIds.map((id) => toolById.get(id)).filter((tool): tool is Tool => Boolean(tool));
    const batch: BatchTransaction = {
      id: batchId,
      operation: input.operation,
      technicianId: technician.id,
      toolIds: uniqueToolIds,
      operatorMode: input.operatorMode,
      identificationMethod: input.identificationMethod,
      scanMethod: input.scanMethod,
      startedAt: input.startedAt,
      completedAt,
    };
    const data: AppData = {
      ...current,
      tools: current.tools.map((tool) => {
        if (!uniqueToolIds.includes(tool.id)) return tool;
        return input.operation === 'loan'
          ? { ...tool, status: 'loaned', technicianId: technician.id, updatedAt: completedAt }
          : { ...tool, status: 'available', technicianId: undefined, updatedAt: completedAt };
      }),
      movements: [
        ...selectedTools.map((tool) => ({
          id: uid('mov'),
          type: input.operation,
          occurredAt: completedAt,
          toolId: tool.id,
          technicianId: technician.id,
          batchId,
          identificationMethod: input.identificationMethod,
          scanMethod: input.scanMethod,
          detail: input.operation === 'loan'
            ? \`${'${tool.name}'} asignada a ${'${technician.name}'}\`
            : \`${'${tool.name}'} devuelta por ${'${technician.name}'}\`,
        } as const)),
        ...current.movements,
      ],
      batches: [batch, ...current.batches],
    };
    return { ok: true, data, value: batch };
  });
}
`;

const storageBridge = `import { useEffect } from 'react';
import { activeStorageKey, announceActiveData } from '../storage';

export default function WorkspaceStorageBridge() {
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key !== null && event.key !== activeStorageKey()) return;
      announceActiveData();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
}
`;

write('src/data/workspaceTransactions.ts', transactions);
write('src/data/WorkspaceStorageBridge.tsx', storageBridge);

replaceExact(
  'src/App.tsx',
  "import { clearData, loadData, saveData } from './storage';\nimport type { AppData, Movement, Technician, Tool, ToolStatus, ViewId } from './types';",
  "import {\n  commitBatchOperation,\n  createTechnicianRecord,\n  createToolRecord,\n  linkToolNfc,\n} from './data/workspaceTransactions';\nimport { clearData, loadData, WORKSPACE_DATA_EVENT } from './storage';\nimport type { AppData, Movement, ToolStatus, ViewId } from './types';",
);

replaceBetween('src/App.tsx', 'const uid = ', 'const formatDate', 'const formatDate');
replaceBetween('src/App.tsx', 'const nextCode = ', 'type ModalName', 'type ModalName');

replaceExact(
  'src/App.tsx',
  "  useEffect(() => saveData(data), [data]);\n  useEffect(() => {\n    if (!notice) return;",
  "  useEffect(() => {\n    const handleDataChange = (event: Event) => {\n      setData((event as CustomEvent<AppData>).detail ?? loadData());\n    };\n    window.addEventListener(WORKSPACE_DATA_EVENT, handleDataChange);\n    return () => window.removeEventListener(WORKSPACE_DATA_EVENT, handleDataChange);\n  }, []);\n\n  useEffect(() => {\n    if (!notice) return;",
);

replaceBetween('src/App.tsx', "  const addMovement = ", "  const closeModal = ", "  const closeModal = ");

replaceBetween('src/App.tsx', "  const createTool = ", "  const createTechnician = ", `  const createTool = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createToolRecord({
      name: toolDraft.name,
      category: toolDraft.category,
      location: toolDraft.location,
      brand: toolDraft.brand,
      model: toolDraft.model,
      serialNumber: toolDraft.serialNumber,
      prefix: prefixes[toolDraft.category] ?? 'HER',
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setToolDraft({ name: '', category: categories[0], location: 'Almacén principal', brand: '', model: '', serialNumber: '' });
    closeModal();
    setNotice(\`${'${result.value.code}'} · ${'${result.value.name}'} creada correctamente.\`);
  };

  const createTechnician = `);

replaceBetween('src/App.tsx', "  const createTechnician = ", "  const registerLoan = ", `  const createTechnician = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createTechnicianRecord({
      name: technicianDraft.name,
      category: technicianDraft.category,
      phone: technicianDraft.phone,
      email: technicianDraft.email,
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setTechnicianDraft({ name: '', category: technicianCategories[0], phone: '', email: '' });
    closeModal();
    setNotice(\`${'${result.value.code}'} · ${'${result.value.name}'} creado correctamente.\`);
  };

  const registerLoan = `);

replaceBetween('src/App.tsx', "  const registerLoan = ", "  const registerReturn = ", `  const registerLoan = async () => {
    if (!selectedToolId || !selectedTechnicianId) return;
    const result = await commitBatchOperation({
      operation: 'loan',
      technicianId: selectedTechnicianId,
      toolIds: [selectedToolId],
      operatorMode: 'administrator',
      identificationMethod: 'manual',
      scanMethod: 'manual',
      startedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    setNotice('Préstamo registrado y auditado en un lote.');
  };

  const registerReturn = `);

replaceBetween('src/App.tsx', "  const registerReturn = ", "  const saveNfc = ", `  const registerReturn = async () => {
    if (!selectedToolId) return;
    const currentTool = data.tools.find((item) => item.id === selectedToolId);
    if (!currentTool?.technicianId) {
      setNotice('La herramienta ya no tiene un responsable válido.');
      return;
    }
    const result = await commitBatchOperation({
      operation: 'return',
      technicianId: currentTool.technicianId,
      toolIds: [selectedToolId],
      operatorMode: 'administrator',
      identificationMethod: 'manual',
      scanMethod: 'manual',
      startedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    setNotice('Devolución registrada y auditada en un lote.');
  };

  const saveNfc = `);

replaceBetween('src/App.tsx', "  const saveNfc = ", "  const resetWorkspace = ", `  const saveNfc = async (writeToTag: boolean) => {
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

  const resetWorkspace = `);

replaceExact(
  'src/scan/ScanSession.tsx',
  "import { loadData, saveData, WORKSPACE_DATA_EVENT } from '../storage';",
  "import { createQuickToolRecord, commitBatchOperation } from '../data/workspaceTransactions';\nimport { loadData, WORKSPACE_DATA_EVENT } from '../storage';",
);
replaceExact(
  'src/scan/ScanSession.tsx',
  "const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;\nconst now = () => new Date().toISOString();",
  "const now = () => new Date().toISOString();",
);

replaceBetween('src/scan/ScanSession.tsx', "  const saveQuickTool = ", "  const finish = ", `  const saveQuickTool = async () => {
    if (!quickTool || !selectedTechnician) return;
    const result = await createQuickToolRecord({
      code: quickTool.code,
      name: quickTool.name,
      categoryId: quickTool.categoryId,
      locationId: quickTool.locationId || undefined,
    });
    setData(result.data);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const tool = result.value;
    setToolIds((current) => current.includes(tool.id) ? current : [...current, tool.id]);
    setScanMethods((current) => new Set(current).add('manual'));
    setQuickTool(null);
    setScanInput('');
    setMessage(\`${'${tool.code}'} · ${'${tool.name}'} registrado y añadido.\`);
  };

  const finish = `);

replaceBetween('src/scan/ScanSession.tsx', "  const finish = ", "  const copyReceipt = ", `  const finish = async () => {
    if (!selectedTechnician || toolIds.length === 0) return;
    const result = await commitBatchOperation({
      operation,
      technicianId: selectedTechnician.id,
      toolIds,
      operatorMode,
      identificationMethod,
      scanMethod: getScanMethod(scanMethods),
      startedAt,
    });
    setData(result.data);
    if (!result.ok) {
      if (result.invalidToolIds?.length) {
        const invalid = new Set(result.invalidToolIds);
        setToolIds((current) => current.filter((id) => !invalid.has(id)));
      }
      setStep('items');
      setMessage(result.message);
      return;
    }
    clearScanDraft();
    setCompletedBatch(result.value);
    setStep('complete');
    setMessage(operationCopy[operation].done);
  };

  const copyReceipt = `);

replaceExact(
  'src/main.tsx',
  "import OperationalCenter from './ecosystem/OperationalCenter';\nimport DesktopUtilityMenu from './header/DesktopUtilityMenu';",
  "import OperationalCenter from './ecosystem/OperationalCenter';\nimport WorkspaceStorageBridge from './data/WorkspaceStorageBridge';\nimport DesktopUtilityMenu from './header/DesktopUtilityMenu';",
);
replaceExact(
  'src/main.tsx',
  "    <DeviceSecurityGate />\n    <EcosystemSwitcher />",
  "    <DeviceSecurityGate />\n    <WorkspaceStorageBridge />\n    <EcosystemSwitcher />",
);

replaceExact('package.json', '"version": "2.0.0-alpha.7.10"', '"version": "2.0.0-alpha.7.11"');
replaceExact('public/sw.js', '`${CACHE_PREFIX}alpha-7-10`', '`${CACHE_PREFIX}alpha-7-11`');

replaceExact(
  'scripts/validate-header-branding.mjs',
  "  \"const CACHE_NAME = `${CACHE_PREFIX}alpha-7-10`\",",
  "  \"const CACHE_NAME = `${CACHE_PREFIX}alpha-7-11`\",",
);
replaceExact(
  'scripts/validate-header-branding.mjs',
  "if (packageJson.version !== '2.0.0-alpha.7.10') fail(`versión inesperada: ${packageJson.version}`);\nif (!serviceWorker.includes('alpha-7-10')) fail('caché PWA no renovada');",
  "if (!/^2\\.0\\.0-alpha\\.7\\.\\d+$/.test(packageJson.version)) fail(`versión inesperada: ${packageJson.version}`);\nconst cacheSuffix = packageJson.version.replace('2.0.0-alpha.', 'alpha-').replaceAll('.', '-');\nif (!serviceWorker.includes(cacheSuffix)) fail(`caché PWA no corresponde a ${packageJson.version}`);",
);

const validator = `import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(\`Consistencia de datos no válida: ${'${message}'}\`);
  process.exit(1);
};
const read = (path) => readFileSync(path, 'utf8');
const app = read('src/App.tsx');
const scan = read('src/scan/ScanSession.tsx');
const transactions = read('src/data/workspaceTransactions.ts');
const bridge = read('src/data/WorkspaceStorageBridge.tsx');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  'WORKSPACE_DATA_EVENT',
  'createToolRecord',
  'createTechnicianRecord',
  'commitBatchOperation',
  'linkToolNfc',
]) {
  if (!app.includes(fragment)) fail(\`App.tsx no contiene ${'${fragment}'}\`);
}
if (app.includes('useEffect(() => saveData(data)')) fail('App conserva el guardado automático de una copia potencialmente obsoleta');

for (const fragment of [
  'createQuickToolRecord',
  'commitBatchOperation',
  'invalidToolIds',
  "setStep('items')",
]) {
  if (!scan.includes(fragment)) fail(\`ScanSession no contiene ${'${fragment}'}\`);
}
if (scan.includes('const nextData: AppData')) fail('ScanSession sigue construyendo el lote desde una copia obsoleta');

for (const fragment of [
  'activeStorageKey()',
  'navigator as WorkspaceNavigator',
  "{ mode: 'exclusive' }",
  'const current = loadData()',
  'technicianIsOperational',
  'toolIsLoanable',
  'new Set(input.toolIds.filter(Boolean))',
  'duplicateTool',
  'duplicateTechnician',
]) {
  if (!transactions.includes(fragment)) fail(\`workspaceTransactions no contiene ${'${fragment}'}\`);
}

for (const fragment of ['StorageEvent', 'activeStorageKey()', 'announceActiveData()']) {
  if (!bridge.includes(fragment)) fail(\`WorkspaceStorageBridge no contiene ${'${fragment}'}\`);
}
if (!main.includes('<WorkspaceStorageBridge />')) fail('WorkspaceStorageBridge no está montado');

if (packageJson.version !== '2.0.0-alpha.7.11') fail(\`versión inesperada: ${'${packageJson.version}'}\`);
if (!serviceWorker.includes('alpha-7-11')) fail('caché PWA no renovada');

console.log('Operaciones consistentes: estado reciente, bloqueo entre pestañas, revalidación final y NFC único.');
`;
write('scripts/validate-data-consistency.mjs', validator);

replaceExact(
  '.github/workflows/validate-v2.yml',
  "      - name: Validar cabecera y branding\n        run: node scripts/validate-header-branding.mjs\n      - name: Validar manifiesto PWA",
  "      - name: Validar cabecera y branding\n        run: node scripts/validate-header-branding.mjs\n      - name: Validar consistencia de datos y operaciones\n        run: node scripts/validate-data-consistency.mjs\n      - name: Validar manifiesto PWA",
);

rmSync('scripts/apply-data-consistency-alpha-7-11.mjs');
rmSync('.github/workflows/apply-data-consistency-alpha-7-11.yml');

console.log('Parche alpha.7.11 aplicado.');
