import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content);
const fail = (message) => { throw new Error(message); };

const replaceExact = (path, search, replacement) => {
  const source = read(path);
  if (!source.includes(search)) fail(`${path}: no se encontró el bloque esperado`);
  write(path, source.replace(search, replacement));
};

const replaceFrom = (path, marker, replacement) => {
  const source = read(path);
  const index = source.indexOf(marker);
  if (index < 0) fail(`${path}: no se encontró ${marker}`);
  write(path, `${source.slice(0, index)}${replacement}`);
};

replaceExact(
  'src/App.tsx',
  "} from './data/workspaceTransactions';",
  "} from './data/workspaceOperations';",
);
replaceExact(
  'src/scan/ScanSession.tsx',
  "from '../data/workspaceTransactions';",
  "from '../data/workspaceOperations';",
);

replaceExact(
  'src/cloud/sync.ts',
  "import type { CloudProfile } from './config';\nimport { createRecord, listRecords, type PocketBaseRecord, updateRecord } from './pocketbaseClient';",
  "import type { CloudProfile } from './config';\nimport { submitAtomicOperation } from './atomicOperations';\nimport {\n  createRecord,\n  listRecords,\n  PocketBaseRequestError,\n  type PocketBaseRecord,\n  updateRecord,\n} from './pocketbaseClient';",
);
replaceExact(
  'src/cloud/sync.ts',
  `export type SyncResult = {
  data: AppData;
  uploaded: number;
  downloaded: number;
};`,
  `export type SyncConflict = {
  batchId: string;
  toolIds: string[];
  message: string;
};

export type SyncResult = {
  data: AppData;
  uploaded: number;
  downloaded: number;
  conflicts: SyncConflict[];
};`,
);

const syncTail = `async function toolPayload(
  tool: Tool,
  status: string,
  technicianExternalId: string,
): Promise<Record<string, unknown>> {
  return {
    code: tool.code,
    name: tool.name,
    category: tool.category,
    category_external_id: tool.categoryId ?? '',
    location: tool.location,
    location_external_id: tool.locationId ?? '',
    tool_kind: tool.kind ?? 'returnable-tool',
    service_state: tool.serviceState ?? (tool.status === 'review' ? 'review' : tool.status === 'retired' ? 'retired' : 'ready'),
    description: tool.description ?? '',
    notes: tool.notes ?? '',
    photo_refs: tool.photos ?? [],
    brand: tool.brand ?? '',
    model: tool.model ?? '',
    serial_number: tool.serialNumber ?? '',
    purchase_date: tool.purchaseDate ?? '',
    purchase_price: tool.purchasePrice ?? null,
    review_due_date: tool.reviewDueDate ?? '',
    calibration_due_date: tool.calibrationDueDate ?? '',
    review_interval_days: tool.reviewIntervalDays ?? null,
    calibration_interval_days: tool.calibrationIntervalDays ?? null,
    quantity: tool.quantity ?? null,
    min_stock: tool.minStock ?? null,
    unit: tool.unit ?? '',
    qr_payload: tool.qrPayload,
    nfc_tag: tool.nfcTag ?? '',
    status,
    technician_external_id: technicianExternalId,
    source_created: tool.createdAt,
    source_updated: tool.updatedAt,
  };
}

async function upsertToolMetadata(
  workspace: string,
  tools: Tool[],
  remoteRecords: PocketBaseRecord[],
): Promise<number> {
  const remote = indexByExternalId(remoteRecords);
  let changed = 0;
  for (const tool of tools) {
    const current = remote.get(tool.id);
    if (!current) {
      await createRecord(COLLECTIONS.tools, {
        workspace,
        external_id: tool.id,
        ...(await toolPayload(tool, 'available', '')),
      });
      changed += 1;
      continue;
    }
    const remoteUpdated = stringValue(current.source_updated);
    if (tool.updatedAt <= remoteUpdated) continue;
    await updateRecord(
      COLLECTIONS.tools,
      current.id,
      await toolPayload(
        tool,
        stringValue(current.status) || 'available',
        stringValue(current.technician_external_id),
      ),
    );
    changed += 1;
  }
  return changed;
}

type PushResult = {
  uploaded: number;
  conflicts: SyncConflict[];
  rejectedBatchIds: Set<string>;
  conflictToolIds: Set<string>;
};

const movementsForBatch = (data: AppData, batchId: string): Movement[] => (
  data.movements.filter((movement) => movement.batchId === batchId)
);

const legacyBatches = (data: AppData, remoteMovementIds: Set<string>): Array<{ batch: BatchTransaction; movements: Movement[] }> => (
  data.movements
    .filter((movement) => (
      (movement.type === 'loan' || movement.type === 'return')
      && !movement.batchId
      && movement.toolId
      && movement.technicianId
      && !remoteMovementIds.has(movement.id)
    ))
    .map((movement) => ({
      batch: {
        id: \`legacy-\${movement.id}\`.slice(0, 120),
        operation: movement.type === 'return' ? 'return' : 'loan',
        technicianId: movement.technicianId ?? '',
        toolIds: movement.toolId ? [movement.toolId] : [],
        operatorMode: movement.identificationMethod === 'authenticated' ? 'self-service' : 'administrator',
        identificationMethod: movement.identificationMethod ?? 'manual',
        scanMethod: movement.scanMethod ?? 'manual',
        startedAt: movement.occurredAt,
        completedAt: movement.occurredAt,
      },
      movements: [{ ...movement, batchId: \`legacy-\${movement.id}\`.slice(0, 120) }],
    }))
);

async function pushWorkspace(data: AppData, profile: CloudProfile, remote: RemoteWorkspace): Promise<PushResult> {
  const workspace = profile.workspace;
  let uploaded = 0;
  const conflicts: SyncConflict[] = [];
  const rejectedBatchIds = new Set<string>();
  const conflictToolIds = new Set<string>();
  const manager = profile.role === 'admin' || profile.role === 'coordinator';

  if (manager) {
    uploaded += await upsertMutable(
      COLLECTIONS.technicians,
      workspace,
      data.technicians.map((technician) => ({
        id: technician.id,
        updatedAt: technician.updatedAt,
        payload: {
          code: technician.code,
          name: technician.name,
          category: technician.category,
          category_external_id: technician.categoryId ?? '',
          technician_status: technician.status ?? (technician.active ? 'active' : 'inactive'),
          company: technician.company ?? '',
          department: technician.department ?? '',
          notes: technician.notes ?? '',
          photo_refs: technician.photos ?? [],
          phone: technician.phone ?? '',
          email: technician.email ?? '',
          qr_payload: technician.qrPayload ?? \`ISIVOLTPRO:TECH:\${technician.code}\`,
          nfc_tag: technician.nfcTag ?? '',
          active: technician.active,
          source_created: technician.createdAt,
          source_updated: technician.updatedAt,
        },
      })),
      remote.records.technicians,
    );
    uploaded += await upsertToolMetadata(workspace, data.tools, remote.records.tools);
  }

  const remoteBatchIds = new Set(remote.records.batches.map((record) => stringValue(record.external_id)));
  const remoteMovementIds = new Set(remote.records.movements.map((record) => stringValue(record.external_id)));
  const operations = [
    ...data.batches.map((batch) => ({ batch, movements: movementsForBatch(data, batch.id) })),
    ...legacyBatches(data, remoteMovementIds),
  ].sort((a, b) => a.batch.completedAt.localeCompare(b.batch.completedAt));

  for (const operation of operations) {
    if (remoteBatchIds.has(operation.batch.id)) continue;
    const result = await submitAtomicOperation(operation, { requireCloud: true });
    if (result.status === 'confirmed') {
      remoteBatchIds.add(operation.batch.id);
      operation.movements.forEach((movement) => remoteMovementIds.add(movement.id));
      uploaded += 1 + operation.movements.length + operation.batch.toolIds.length;
      continue;
    }
    if (result.status === 'pending' || result.status === 'local') {
      throw new PocketBaseRequestError(
        result.status === 'pending' ? result.message : 'La operación sigue pendiente de conexión.',
        0,
      );
    }
    rejectedBatchIds.add(operation.batch.id);
    operation.batch.toolIds.forEach((toolId) => conflictToolIds.add(toolId));
    conflicts.push({
      batchId: operation.batch.id,
      toolIds: operation.batch.toolIds,
      message: result.message,
    });
  }

  if (manager) {
    uploaded += await createMissing(
      COLLECTIONS.movements,
      workspace,
      data.movements
        .filter((movement) => movement.type !== 'loan' && movement.type !== 'return')
        .map((movement) => ({
          id: movement.id,
          payload: {
            type: movement.type,
            occurred_at: movement.occurredAt,
            tool_external_id: movement.toolId ?? '',
            technician_external_id: movement.technicianId ?? '',
            batch_external_id: movement.batchId ?? '',
            identification_method: movement.identificationMethod ?? '',
            scan_method: movement.scanMethod ?? '',
            detail: movement.detail,
          },
        })),
      remote.records.movements,
    );
  }

  return { uploaded, conflicts, rejectedBatchIds, conflictToolIds };
}

export async function synchronizeWorkspace(local: AppData, profile: CloudProfile): Promise<SyncResult> {
  const normalizedLocal = normalizeAppData(local) ?? local;
  const firstRemote = await loadRemoteWorkspace(profile.workspace);
  const merged = mergeWorkspaceData(normalizedLocal, firstRemote.data);
  const pushed = await pushWorkspace(merged, profile, firstRemote);
  const finalRemote = pushed.uploaded > 0 || pushed.conflicts.length > 0
    ? await loadRemoteWorkspace(profile.workspace)
    : firstRemote;

  const rejectedMovementIds = new Set(
    merged.movements
      .filter((movement) => movement.batchId && pushed.rejectedBatchIds.has(movement.batchId))
      .map((movement) => movement.id),
  );
  const localForMerge: AppData = {
    ...merged,
    batches: merged.batches.filter((batch) => !pushed.rejectedBatchIds.has(batch.id)),
    movements: merged.movements.filter((movement) => !rejectedMovementIds.has(movement.id)),
  };
  const finalData = mergeWorkspaceData(localForMerge, finalRemote.data);

  if (pushed.conflictToolIds.size > 0) {
    const canonicalTools = new Map(finalRemote.data.tools.map((tool) => [tool.id, tool]));
    finalData.tools = finalData.tools.map((tool) => (
      pushed.conflictToolIds.has(tool.id) ? canonicalTools.get(tool.id) ?? tool : tool
    ));
  }

  const localIds = new Set([
    ...normalizedLocal.technicians.map((item) => \`t:\${item.id}\`),
    ...normalizedLocal.tools.map((item) => \`i:\${item.id}\`),
    ...normalizedLocal.batches.map((item) => \`b:\${item.id}\`),
    ...normalizedLocal.movements.map((item) => \`m:\${item.id}\`),
  ]);
  const downloaded = [
    ...finalData.technicians.map((item) => \`t:\${item.id}\`),
    ...finalData.tools.map((item) => \`i:\${item.id}\`),
    ...finalData.batches.map((item) => \`b:\${item.id}\`),
    ...finalData.movements.map((item) => \`m:\${item.id}\`),
  ].filter((id) => !localIds.has(id)).length;

  return {
    data: finalData,
    uploaded: pushed.uploaded,
    downloaded,
    conflicts: pushed.conflicts,
  };
}
`;
replaceFrom('src/cloud/sync.ts', 'async function pushWorkspace', syncTail);

replaceExact(
  'src/cloud/CloudStatus.tsx',
  `      setState('synced');
      const uploaded = coreResult.uploaded + catalogResult.uploaded;
      const downloaded = coreResult.downloaded + catalogResult.downloaded;
      setMessage(
        uploaded || downloaded
          ? \`${'${uploaded}'} cambios enviados · ${'${downloaded}'} recibidos.\`
          : 'Todos los datos están actualizados.',
      );`,
  `      const uploaded = coreResult.uploaded + catalogResult.uploaded;
      const downloaded = coreResult.downloaded + catalogResult.downloaded;
      if (coreResult.conflicts.length > 0) {
        setState('error');
        setError(
          \`${'${coreResult.conflicts.length}'} operación${'${coreResult.conflicts.length === 1 ? \'\' : \'es\'}'} no se pudo confirmar: ${'${coreResult.conflicts[0].message}'}\`,
        );
        setMessage('Se ha recuperado el estado válido del servidor central. Revisa el lote antes de repetirlo.');
      } else {
        setState('synced');
        setMessage(
          uploaded || downloaded
            ? \`${'${uploaded}'} cambios enviados · ${'${downloaded}'} recibidos.\`
            : 'Todos los datos están actualizados.',
        );
      }`,
);

replaceExact('package.json', '"version": "2.0.0-alpha.7.11"', '"version": "2.0.0-alpha.7.12"');
replaceExact('public/sw.js', '`${CACHE_PREFIX}alpha-7-11`', '`${CACHE_PREFIX}alpha-7-12`');

replaceExact(
  'deploy/pocketbase/install.sh',
  'install -d -m 0755 -o root -g root "$INSTALL_DIR/pb_migrations"',
  'install -d -m 0755 -o root -g root "$INSTALL_DIR/pb_migrations" "$INSTALL_DIR/pb_hooks"',
);
replaceExact(
  'deploy/pocketbase/install.sh',
  `find "$INSTALL_DIR/pb_migrations" -maxdepth 1 -type f -name '*.js' -delete
find "$REPO_ROOT/pb_migrations" -maxdepth 1 -type f -name '*.js' -print0 \\
  | sort -z \\
  | xargs -0 -r -I{} install -m 0644 -o root -g root "{}" "$INSTALL_DIR/pb_migrations/"`,
  `find "$INSTALL_DIR/pb_migrations" -maxdepth 1 -type f -name '*.js' -delete
find "$REPO_ROOT/pb_migrations" -maxdepth 1 -type f -name '*.js' -print0 \\
  | sort -z \\
  | xargs -0 -r -I{} install -m 0644 -o root -g root "{}" "$INSTALL_DIR/pb_migrations/"

find "$INSTALL_DIR/pb_hooks" -maxdepth 1 -type f -name '*.js' -delete
find "$REPO_ROOT/pb_hooks" -maxdepth 1 -type f -name '*.js' -print0 \\
  | sort -z \\
  | xargs -0 -r -I{} install -m 0644 -o root -g root "{}" "$INSTALL_DIR/pb_hooks/"`,
);
replaceExact(
  'deploy/pocketbase/install.sh',
  `if ! find "$INSTALL_DIR/pb_migrations" -maxdepth 1 -type f -name '*.js' | grep -q .; then
  echo "No se encontraron migraciones en $REPO_ROOT/pb_migrations" >&2
  exit 1
fi`,
  `if ! find "$INSTALL_DIR/pb_migrations" -maxdepth 1 -type f -name '*.js' | grep -q .; then
  echo "No se encontraron migraciones en $REPO_ROOT/pb_migrations" >&2
  exit 1
fi
if ! find "$INSTALL_DIR/pb_hooks" -maxdepth 1 -type f -name '*.js' | grep -q .; then
  echo "No se encontraron hooks en $REPO_ROOT/pb_hooks" >&2
  exit 1
fi`,
);
replaceExact(
  'deploy/pocketbase/install.sh',
  'Migraciones:    $INSTALL_DIR/pb_migrations',
  'Migraciones:    $INSTALL_DIR/pb_migrations\nHooks atómicos:  $INSTALL_DIR/pb_hooks',
);
replaceExact(
  'deploy/pocketbase/isivoltpro-pocketbase.service',
  '--migrationsDir=/opt/isivoltpro-pocketbase/pb_migrations',
  '--migrationsDir=/opt/isivoltpro-pocketbase/pb_migrations --hooksDir=/opt/isivoltpro-pocketbase/pb_hooks',
);

replaceExact(
  '.github/workflows/validate-v2.yml',
  `      - name: Validar consistencia de datos y operaciones
        run: node scripts/validate-data-consistency.mjs
      - name: Validar manifiesto PWA`,
  `      - name: Validar consistencia de datos y operaciones
        run: node scripts/validate-data-consistency.mjs
      - name: Validar operaciones atómicas de servidor
        run: node scripts/validate-atomic-operations.mjs
      - name: Validar manifiesto PWA`,
);
replaceExact(
  '.github/workflows/validate-v2.yml',
  `      - name: Probar catálogos y ubicaciones con PocketBase real
        env:
          PB_VERSION: 0.39.9
        run: bash scripts/test-pocketbase-catalogs.sh`,
  `      - name: Probar catálogos y ubicaciones con PocketBase real
        env:
          PB_VERSION: 0.39.9
        run: bash scripts/test-pocketbase-catalogs.sh
      - name: Probar concurrencia atómica con PocketBase real
        env:
          PB_VERSION: 0.39.9
        run: bash scripts/test-pocketbase-atomic-operations.sh`,
);

rmSync('scripts/apply-alpha-7-12.mjs');
console.log('Integración alpha.7.12 aplicada.');
