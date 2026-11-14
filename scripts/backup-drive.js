import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DRIVE_BACKUP_FOLDER_ID = '1waXRcUZg4hl5ESv1vWI_mrSMTm3gozuT';

export function backupFilename(date = new Date(), suffix = randomBytes(6).toString('hex')) {
  if (Number.isNaN(date.getTime()) || !/^[a-f0-9]{12}$/.test(suffix))
    throw new Error('DRIVE_BACKUP_FILENAME_INVALID');
  const timestamp = date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `saldolab-${timestamp}-${suffix}.saldolab.enc`;
}

export function remoteChecksum(text, filename) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length !== 1) throw new Error('DRIVE_BACKUP_REMOTE_CHECKSUM_INVALID');
  const match = /^([a-f0-9]{32})\s+(.+)$/i.exec(lines[0]);
  if (!match || match[2] !== filename) throw new Error('DRIVE_BACKUP_REMOTE_CHECKSUM_INVALID');
  return match[1].toLowerCase();
}

export function backupSettings(env) {
  if (!env.SALDOLAB_BACKUP_LOCAL_DIR || !isAbsolute(env.SALDOLAB_BACKUP_LOCAL_DIR))
    throw new Error('DRIVE_BACKUP_LOCAL_DIR_REQUIRED');
  const remote = env.SALDOLAB_DRIVE_REMOTE || 'saldolab-drive';
  if (!/^[a-z0-9_-]{1,60}$/i.test(remote)) throw new Error('DRIVE_BACKUP_REMOTE_INVALID');
  if (!env.SALDOLAB_BACKUP_DATABASE_URL || !env.SALDOLAB_BACKUP_PASSPHRASE)
    throw new Error('DRIVE_BACKUP_SECRETS_REQUIRED');
  const dir = resolve(env.SALDOLAB_BACKUP_LOCAL_DIR);
  const cwd = resolve(process.cwd());
  const relativeToProject = relative(cwd, dir);
  if (!relativeToProject || (!relativeToProject.startsWith('..') && !isAbsolute(relativeToProject)))
    throw new Error('DRIVE_BACKUP_LOCAL_DIR_MUST_BE_OUTSIDE_PROJECT');
  return { dir, remote };
}

function run(command, args, { capture = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      if (capture && output.length < 8192) output += chunk.toString();
    });
    child.stderr.on('data', () => {});
    child.on('error', () => reject(new Error('DRIVE_BACKUP_TOOL_UNAVAILABLE')));
    child.on('close', (code) => {
      if (code !== 0) reject(new Error('DRIVE_BACKUP_COMMAND_FAILED'));
      else resolvePromise(output);
    });
  });
}

async function md5(file) {
  const hash = createHash('md5');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  const { dir, remote } = backupSettings(process.env);
  const info = await stat(dir);
  if (!info.isDirectory()) throw new Error('DRIVE_BACKUP_LOCAL_DIR_REQUIRED');
  const filename = backupFilename();
  const local = join(dir, filename);
  const destination = `${remote}:${filename}`;
  const folderOption = ['--drive-root-folder-id', DRIVE_BACKUP_FOLDER_ID];

  await run(process.execPath, [
    fileURLToPath(new URL('./backup-postgres.js', import.meta.url)),
    'create',
    local,
  ]);
  await run('rclone', ['copyto', local, destination, '--immutable', '--checksum', ...folderOption]);
  const checksumText = await run('rclone', ['md5sum', destination, ...folderOption], {
    capture: true,
  });
  if ((await md5(local)) !== remoteChecksum(checksumText, basename(local)))
    throw new Error('DRIVE_BACKUP_REMOTE_CHECKSUM_MISMATCH');
  console.log('DRIVE_BACKUP_UPLOAD_VERIFIED');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    const safe = /^DRIVE_BACKUP_[A-Z_]+$/.test(error.message);
    console.error(safe ? error.message : 'DRIVE_BACKUP_FAILED');
    process.exitCode = 1;
  });
