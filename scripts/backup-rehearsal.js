// Ensaio isolado: PostgreSQL 17 em Docker, dados artificiais e restauração real.
// Sem acesso a Neon, Google Drive ou credenciais de produção.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptBackup, decryptBackup } from './backup-crypto.js';

const CONTAINER = 'saldolab-backup-rehearsal';
const SECRET = 'QA-only-passphrase-never-use-for-real-backups';
const SOURCE = 'saldolab_fixture_source';
const RESTORED = 'saldolab_fixture_restored';

async function command(commandName, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    child.stdout.on('data', (data) => out.push(data));
    child.stderr.on('data', (data) => {
      if (Buffer.concat(err).length < 4096) err.push(data);
    });
    child.on('error', reject);
    if (input === undefined) child.stdin.end();
    else child.stdin.end(input);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error('QA_COMMAND_FAILED: ' + commandName));
      else resolve(Buffer.concat(out).toString('utf8'));
    });
  });
}

const db = (database, sql) =>
  command('docker', ['exec', CONTAINER, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-c', sql]);

async function main() {
  const folder = await mkdtemp(join(tmpdir(), 'saldolab-restore-rehearsal-'));
  const encrypted = join(folder, 'fixture.saldolab.enc');
  try {
    await db('postgres', 'CREATE DATABASE ' + SOURCE);
    await db('postgres', 'CREATE DATABASE ' + RESTORED);
    await db(SOURCE, "CREATE TABLE financial_fixture (id integer PRIMARY KEY, cents integer NOT NULL, label text NOT NULL)");
    await db(SOURCE, "INSERT INTO financial_fixture VALUES (1, 275000, 'fixture'), (2, -75000, 'fixture-two')");
    const dump = spawn('docker', ['exec', CONTAINER, 'pg_dump', '-U', 'postgres', '-Fc', '--no-owner', '--no-acl', '-d', SOURCE], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const completed = new Promise((resolve, reject) => {
      dump.on('error', reject);
      dump.on('close', (code) => code === 0 ? resolve() : reject(new Error('QA_DUMP_FAILED')));
    });
    completed.catch(() => {});
    await Promise.all([encryptBackup(dump.stdout, encrypted, SECRET), completed]);
    const bytes = await readFile(encrypted);
    if (bytes.includes(Buffer.from('fixture-two'))) throw new Error('QA_ENCRYPTION_LEAK');
    const restore = spawn('docker', ['exec', '-i', CONTAINER, 'pg_restore', '-U', 'postgres', '-d', RESTORED, '--no-owner', '--no-acl', '--exit-on-error'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const restored = new Promise((resolve, reject) => {
      restore.on('error', reject);
      restore.on('close', (code) => code === 0 ? resolve() : reject(new Error('QA_RESTORE_FAILED')));
    });
    restored.catch(() => {});
    await Promise.all([decryptBackup(encrypted, restore.stdin, SECRET), restored]);
    const source = (await db(SOURCE, 'SELECT count(*), sum(cents) FROM financial_fixture')).trim();
    const target = (await db(RESTORED, 'SELECT count(*), sum(cents) FROM financial_fixture')).trim();
    if (source !== '2|200000' || target !== source) throw new Error('QA_RESTORE_MISMATCH');
    console.log('QA_POSTGRES_17_ENCRYPT_DECRYPT_RESTORE_OK');
  } finally {
    await rm(folder, { force: true, recursive: true });
  }
}

main().catch(() => {
  console.error('QA_BACKUP_REHEARSAL_FAILED');
  process.exitCode = 1;
});
