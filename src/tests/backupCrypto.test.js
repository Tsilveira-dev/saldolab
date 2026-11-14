import { describe, expect, it } from 'vitest';
import { Readable, Writable } from 'node:stream';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptBackup, decryptBackup } from '../../scripts/backup-crypto.js';

const passphrase = 'passphrase-created-for-automated-tests-only';

async function decrypted(file, secret = passphrase) {
  const chunks = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  await decryptBackup(file, sink, secret);
  return Buffer.concat(chunks);
}

describe('backup PostgreSQL criptografado e atômico', () => {
  it('preserva arquivos grandes em streaming e não expõe o conteúdo no disco', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'saldolab-backup-'));
    try {
      const target = join(folder, 'test.saldolab.enc');
      const data = Buffer.concat([
        Buffer.from('PGDMP-secret-financial-data'),
        Buffer.alloc(160000, 7),
      ]);
      await encryptBackup(Readable.from([data]), target, passphrase);
      const encrypted = await readFile(target);
      expect(encrypted.includes(Buffer.from('secret-financial-data'))).toBe(false);
      expect(await decrypted(target)).toEqual(data);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it('rejeita senha incorreta e alterações nos dados cifrados', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'saldolab-backup-'));
    try {
      const target = join(folder, 'test.saldolab.enc');
      await encryptBackup(Readable.from([Buffer.from('PGDMP-finance')]), target, passphrase);
      await expect(decrypted(target, 'different-passphrase-for-this-test')).rejects.toThrow();
      const modified = await readFile(target);
      modified[50] ^= 1;
      await writeFile(target, modified);
      await expect(decrypted(target)).rejects.toThrow();
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it('não substitui um backup existente nem aceita senha curta', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'saldolab-backup-'));
    try {
      const target = join(folder, 'test.saldolab.enc');
      await encryptBackup(Readable.from([Buffer.from('PGDMP-1')]), target, passphrase);
      await expect(
        encryptBackup(Readable.from([Buffer.from('PGDMP-2')]), target, passphrase),
      ).rejects.toThrow();
      expect(await decrypted(target)).toEqual(Buffer.from('PGDMP-1'));
      await expect(
        encryptBackup(Readable.from([Buffer.from('PGDMP-3')]), join(folder, 'bad.enc'), 'short'),
      ).rejects.toThrow('BACKUP_PASSPHRASE_TOO_SHORT');
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
