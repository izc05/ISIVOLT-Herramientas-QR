import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const manifestPath = resolve('android/app/src/main/AndroidManifest.xml');
const extractionRulesPath = resolve('android/app/src/main/res/xml/data_extraction_rules.xml');
const javaPackagePath = resolve('android/app/src/main/java/com/isivolt/herramientasqr');
const mainActivityPath = resolve(javaPackagePath, 'MainActivity.java');
const nfcPluginPath = resolve(javaPackagePath, 'IsivoltNfcPlugin.java');

let manifest = await readFile(manifestPath, 'utf8');

if (!manifest.includes('android.permission.CAMERA')) {
  manifest = manifest.replace(
    '<application',
    '    <uses-permission android:name="android.permission.CAMERA" />\n\n    <application',
  );
}

if (!manifest.includes('android.permission.NFC')) {
  manifest = manifest.replace(
    '<application',
    '    <uses-permission android:name="android.permission.NFC" />\n    <uses-feature android:name="android.hardware.nfc" android:required="false" />\n\n    <application',
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

await mkdir(javaPackagePath, { recursive: true });
await writeFile(
  mainActivityPath,
  `package com.isivolt.herramientasqr;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IsivoltNfcPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`,
  'utf8',
);

await writeFile(
  nfcPluginPath,
  `package com.isivolt.herramientasqr;

import android.nfc.NfcAdapter;
import android.nfc.Tag;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "IsivoltNfc")
public class IsivoltNfcPlugin extends Plugin implements NfcAdapter.ReaderCallback {
    private NfcAdapter nfcAdapter;
    private boolean scanning = false;

    private NfcAdapter getAdapter() {
        if (nfcAdapter == null) {
            nfcAdapter = NfcAdapter.getDefaultAdapter(getContext());
        }
        return nfcAdapter;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        NfcAdapter adapter = getAdapter();
        JSObject result = new JSObject();
        result.put("available", adapter != null);
        result.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void startScan(PluginCall call) {
        NfcAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("Este dispositivo no dispone de lector NFC.");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("NFC está desactivado.");
            return;
        }

        int flags = NfcAdapter.FLAG_READER_NFC_A
            | NfcAdapter.FLAG_READER_NFC_B
            | NfcAdapter.FLAG_READER_NFC_F
            | NfcAdapter.FLAG_READER_NFC_V
            | NfcAdapter.FLAG_READER_NFC_BARCODE
            | NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS;

        getActivity().runOnUiThread(() -> {
            adapter.enableReaderMode(getActivity(), this, flags, null);
            scanning = true;
            call.resolve();
        });
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        disableReaderMode();
        call.resolve();
    }

    private void disableReaderMode() {
        NfcAdapter adapter = getAdapter();
        if (adapter == null || getActivity() == null) {
            scanning = false;
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                adapter.disableReaderMode(getActivity());
            } catch (IllegalStateException ignored) {
                // La actividad puede estar pausándose.
            }
            scanning = false;
        });
    }

    @Override
    public void onTagDiscovered(Tag tag) {
        if (!scanning || tag == null) return;

        JSObject result = new JSObject();
        result.put("uid", bytesToHex(tag.getId()));
        JSArray technologies = new JSArray();
        for (String technology : tag.getTechList()) {
            technologies.put(technology);
        }
        result.put("techTypes", technologies);

        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> notifyListeners("nfcTagScanned", result));
        } else {
            notifyListeners("nfcTagScanned", result);
        }
    }

    @Override
    protected void handleOnDestroy() {
        disableReaderMode();
        super.handleOnDestroy();
    }

    private String bytesToHex(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return "";
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02X", value));
        }
        return builder.toString();
    }
}
`,
  'utf8',
);

console.log('Android configurado: cámara ML Kit, lector NFC local y base de datos excluida de copias no controladas.');
