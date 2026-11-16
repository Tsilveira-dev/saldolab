import { spawn } from 'node:child_process';
import { access, stat, unlink } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encryptBackup, decryptBackup } from './backup-crypto.js';

const PASSPHRASE = process.env.SALDOLAB_BACKUP_PASSPHRASE;

function directDatabaseEnvironment(rawUrl) {
  if (!rawUrl) throw new Error('BACKUP_DATABASE_URL_REQUIRED');
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('BACKUP_DATABASE_URL_INVALID');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('BACKUP_DATABASE_URL_INVALID');
  if (!url.hostname || !url.username || !url.password || !url.pathname.slice(1))
    throw new Error('BACKUP_DATABASE_URL_INVALID');
  if (url.hostname.includes('-pooler')) throw new Error('BACKUP_DIRECT_CONNECTION_REQUIRED');

  const safe = { ...process.env };
  delete safe.SALDOLAB_BACKUP_DATABASE_URL;
  delete safe.SALDOLAB_BACKUP_PASSPHRASE;
  return {
    ...safe,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: 'verify-full',
  };
}

function command(name, args, env) {
  const child = spawn(name, args, {
    env,
    stdio: ['pipe', name === 'pg_dump' ? 'pipe' : 'ignore', 'ignore'],
  });
  const completed = new Promise((done, reject) => {
    child.on('error', () => reject(new Error('BACKUP_POSTGRES_TOOL_UNAVAILABLE')));
    child.on('close', (code) => {
      if (code === 0) done();
      else reject(new Error('BACKUP_POSTGRES_TOOL_FAILED'));
    });
  });
  completed.catch(() => {});
  return { child, completed };
}

async function createBackup(file) {
  const target = resolve(file);
  if (target.startsWith(resolve(process.cwd()) + sep))
    throw new Error('BACKUP_DESTINATION_MUST_BE_OUTSIDE_PROJECT');
  await access(dirname(target));
  await stat(target).then(
    () => {
      throw new Error('BACKUP_DESTINATION_EXISTS');
    },
    (error) => {
      if (error.code !== 'ENOENT') throw error;
    },
  );
  const env = directDatabaseEnvironment(process.env.SALDOLAB_BACKUP_DATABASE_URL);
  const { child, completed } = command(
    'pg_dump',
    ['--format=custom', '--no-owner', '--no-acl'],
    env,
  );
  try {
    await Promise.all([encryptBackup(child.stdout, target, PASSPHRASE), completed]);
  } catch (error) {
    child.kill();
    await unlink(target).catch(() => {});
    throw error;
  }
  return target;
}

async function verifyBackup(file) {
  const { child, completed } = command('pg_restore', ['--list'], process.env);
  try {
    await Promise.all([decryptBackup(resolve(file), child.stdin, PASSPHRASE), completed]);
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function main() {
  const [action, filename] = process.argv.slice(2);
  if (!['create', 'verify'].includes(action) || !filename) throw new Error('BACKUP_USAGE_INVALID');
  if (action === 'create') {
    const path = await createBackup(filename);
    try {
      await verifyBackup(path);
    } catch (error) {
      await unlink(path).catch(() => {});
      throw error;
    }
    console.log('BACKUP_ENCRYPTED_AND_VERIFIED');
  } else {
    await verifyBackup(filename);
    console.log('BACKUP_VERIFIED');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(
      /^BACKUP_[A-Z_]+$/.test(error.message) ? error.message : 'BACKUP_OPERATION_FAILED',
    );
    process.exitCode = 1;
  });
