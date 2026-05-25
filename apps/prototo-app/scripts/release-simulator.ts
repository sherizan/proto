import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const SDK_MAJOR = readSdkMajor();
const TAG_PREFIX = `prototo-sim-sdk${SDK_MAJOR}`;
const LATEST_TAG = `${TAG_PREFIX}-latest`;

function readSdkMajor(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  const expoSpec: string | undefined = pkg.dependencies?.expo;
  if (!expoSpec) throw new Error('expo dep not found in apps/prototo-app/package.json');
  const m = expoSpec.match(/(\d+)\./);
  if (!m) throw new Error(`could not parse expo version from ${expoSpec}`);
  return m[1];
}

function shInherit(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

function shCapture(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
}

function nextBuildNumber(): number {
  try {
    const out = shCapture('gh', ['release', 'list', '--limit', '100', '--json', 'tagName']);
    const tags: { tagName: string }[] = JSON.parse(out);
    const numbers = tags
      .map((t) => {
        const m = t.tagName.match(new RegExp(`^${TAG_PREFIX}-(\\d+)$`));
        return m ? Number(m[1]) : null;
      })
      .filter((n): n is number => n !== null);
    return numbers.length ? Math.max(...numbers) + 1 : 1;
  } catch {
    return 1;
  }
}

async function main(): Promise<void> {
  const build = nextBuildNumber();
  const tag = `${TAG_PREFIX}-${build}`;
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prototo-release-'));

  console.log(`==> Resolving most recent development-simulator EAS build`);
  const easJson = shCapture('eas', [
    'build:list',
    '--platform',
    'ios',
    '--status',
    'finished',
    '--limit',
    '10',
    '--json',
    '--non-interactive',
  ]);
  const builds: Array<{
    id: string;
    buildProfile: string;
    artifacts?: { applicationArchiveUrl?: string };
  }> = JSON.parse(easJson);
  const simBuild = builds.find((b) => b.buildProfile === 'development-simulator');
  if (!simBuild?.artifacts?.applicationArchiveUrl) {
    throw new Error(
      'No finished development-simulator build found. Run: eas build --platform ios --profile development-simulator',
    );
  }

  console.log(`==> Downloading artifact from EAS (build ${simBuild.id})`);
  const downloadedPath = path.join(workDir, 'eas-artifact.tar.gz');
  shInherit('curl', ['-L', '-o', downloadedPath, simBuild.artifacts.applicationArchiveUrl]);

  console.log(`==> Re-packing as Prototo.app.tar.gz`);
  const unpackDir = path.join(workDir, 'unpack');
  fs.mkdirSync(unpackDir, { recursive: true });
  shInherit('tar', ['-xzf', downloadedPath, '-C', unpackDir]);
  const appName = fs.readdirSync(unpackDir).find((n) => n.endsWith('.app'));
  if (!appName) throw new Error(`No .app found inside ${downloadedPath}`);
  if (appName !== 'Prototo.app') {
    fs.renameSync(path.join(unpackDir, appName), path.join(unpackDir, 'Prototo.app'));
  }
  const finalTarball = path.join(workDir, 'Prototo.app.tar.gz');
  shInherit('tar', ['-czf', finalTarball, '-C', unpackDir, 'Prototo.app']);

  console.log(`==> Computing SHA256`);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(finalTarball)).digest('hex');

  console.log(`==> Writing manifest`);
  const manifest = {
    sdkMajor: Number(SDK_MAJOR),
    sha256,
    builtAt: new Date().toISOString(),
  };
  const manifestPath = path.join(workDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`==> Creating GitHub release ${tag}`);
  shInherit('gh', [
    'release',
    'create',
    tag,
    '--title',
    tag,
    '--notes',
    `Prototo simulator binary for Expo SDK ${SDK_MAJOR}`,
    finalTarball,
    manifestPath,
  ]);

  console.log(`==> Updating ${LATEST_TAG} pointer`);
  try {
    shInherit('gh', ['release', 'delete', LATEST_TAG, '--yes', '--cleanup-tag']);
  } catch {
    // first run — no -latest to delete
  }
  shInherit('gh', [
    'release',
    'create',
    LATEST_TAG,
    '--title',
    LATEST_TAG,
    '--notes',
    `Pointer to ${tag}`,
    finalTarball,
    manifestPath,
  ]);

  console.log(`✓ Released ${tag} and updated ${LATEST_TAG}`);
  console.log(
    `  Manifest: https://github.com/sherizan/proto/releases/download/${LATEST_TAG}/manifest.json`,
  );
  console.log(
    `  Tarball:  https://github.com/sherizan/proto/releases/download/${LATEST_TAG}/Prototo.app.tar.gz`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
