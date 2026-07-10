import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
const versionName = String(packageJson.version);
const match = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(versionName);
if (!match) throw new Error(`Versión no compatible con Android: ${versionName}`);

const [, majorText, minorText, patchText, rcText] = match;
const major = Number(majorText);
const minor = Number(minorText);
const patch = Number(patchText);
const releaseOffset = rcText ? Math.min(89, Number(rcText)) : 99;
const versionCode = major * 1_000_000 + minor * 10_000 + patch * 100 + releaseOffset;

const buildGradlePath = resolve('android/app/build.gradle');
let gradle = await readFile(buildGradlePath, 'utf8');

gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);

const keystorePath = process.env.ANDROID_KEYSTORE_PATH;
const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD;
const keyAlias = process.env.ANDROID_KEY_ALIAS;
const keyPassword = process.env.ANDROID_KEY_PASSWORD;
const signingReady = Boolean(keystorePath && storePassword && keyAlias && keyPassword);

if (signingReady && !gradle.includes('signingConfigs.productionRelease')) {
  const signingBlock = `
    signingConfigs {
        productionRelease {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            enableV1Signing true
            enableV2Signing true
        }
    }
`;
  gradle = gradle.replace(/android\s*\{/, `android {${signingBlock}`);
  gradle = gradle.replace(
    /release\s*\{\s*minifyEnabled/,
    'release {\n            signingConfig signingConfigs.productionRelease\n            minifyEnabled',
  );
}

await writeFile(buildGradlePath, gradle, 'utf8');

const metadata = {
  versionName,
  versionCode,
  signed: signingReady,
  generatedAt: new Date().toISOString(),
};
await writeFile(resolve('android/build-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
console.log(`Android configurado: ${versionName} (${versionCode}) · firma ${signingReady ? 'activada' : 'no configurada'}.`);
