import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, rename, stat, unlink } from 'node:fs/promises';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';

const HEADER = Buffer.from('SALDOLAB-PGDUMP-V1\n', 'ascii');
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX_LENGTH = HEADER.length + SALT_LENGTH + IV_LENGTH;

function keyFor(passphrase, salt) {
  if (typeof passphrase !== 'string' || passphrase.length < 20)
    throw new Error('BACKUP_PASSPHRASE_TOO_SHORT');
  return scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

async function writeChunk(stream, chunk) {
  if (!chunk.length) return;
  if (!stream.write(chunk)) await once(stream, 'drain');
}

// Encrypt pg_dump stdout directly. Never store an unencrypted dump.
export async function encryptBackup(source, destination, passphrase) {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', keyFor(passphrase, salt), iv);
  const temporary = destination + '.partial';
  const output = createWriteStream(temporary, { flags: 'wx', mode: 0o600 });
  try {
    await writeChunk(output, Buffer.concat([HEADER, salt, iv]));
    for await (const chunk of source) await writeChunk(output, cipher.update(chunk));
    await writeChunk(output, cipher.final());
    await writeChunk(output, cipher.getAuthTag());
    output.end();
    await finished(output);
    await rename(temporary, destination);
  } catch (error) {
    output.destroy();
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

// Verify GCM before trusting the archive. Use pg_restore --list on decrypted
// bytes to check the PostgreSQL custom format WITHOUT restoring a database.
export async function decryptBackup(sourcePath, destination, passphrase) {
  const size = (await stat(sourcePath)).size;
  if (size <= PREFIX_LENGTH + TAG_LENGTH) throw new Error('BACKUP_FORMAT_INVALID');
  const handle = await open(sourcePath, 'r');
  let prefix;
  let tag;
  try {
    prefix = Buffer.alloc(PREFIX_LENGTH);
    tag = Buffer.alloc(TAG_LENGTH);
    await handle.read(prefix, 0, prefix.length, 0);
    await handle.read(tag, 0, tag.length, size - TAG_LENGTH);
  } finally {
    await handle.close();
  }
  if (!prefix.subarray(0, HEADER.length).equals(HEADER)) throw new Error('BACKUP_FORMAT_INVALID');
  const salt = prefix.subarray(HEADER.length, HEADER.length + SALT_LENGTH);
  const iv = prefix.subarray(HEADER.length + SALT_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', keyFor(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  const encrypted = createReadStream(sourcePath, {
    start: PREFIX_LENGTH,
    end: size - TAG_LENGTH - 1,
  });
  try {
    for await (const chunk of encrypted) await writeChunk(destination, decipher.update(chunk));
    await writeChunk(destination, decipher.final());
    destination.end();
    await finished(destination);
  } catch (error) {
    encrypted.destroy();
    destination.destroy();
    throw error;
  }
}
