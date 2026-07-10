import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const manifestPath = resolve('android/app/src/main/AndroidManifest.xml');
const extractionRulesPath = resolve('android/app/src/main/res/xml/data_extraction_rules.xml');

let manifest = await readFile(manifestPath, 'utf8');

if (!manifest.includes('android.permission.CAMERA')) {
  manifest = manifest.replace(
    '<application',
    '    <uses-permission android:name="android.permission.CAMERA" />\n\n    <application',
  );
}

manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');

if (!manifest.includes('android:fullBackupContent=')) {
  manifest = manifest.replace(
    '<application',
    '<application\n        android:fullBackupContent="false"\n        android:dataExtractionRules="@xml/data_extraction_rules"',
  );
}

if (!manifest.includes('com.google.mlkit.vision.DEPENDENCIES')) {
  manifest = manifest.replace(
    '</application>',
    '        <meta-data\n            android:name="com.google.mlkit.vision.DEPENDENCIES"\n            android:value="barcode_ui" />\n    </application>',
  );
}

await writeFile(manifestPath, manifest, 'utf8');
await mkdir(dirname(extractionRulesPath), { recursive: true });
await writeFile(
  extractionRulesPath,
  `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="root" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
        <exclude domain="external" />
    </cloud-backup>
    <device-transfer>
        <exclude domain="root" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
        <exclude domain="external" />
    </device-transfer>
</data-extraction-rules>
`,
  'utf8',
);

console.log('Android configurado: cámara ML Kit y base de datos excluida de copias no controladas.');
