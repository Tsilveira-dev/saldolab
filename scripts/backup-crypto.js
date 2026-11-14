import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, link, stat, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

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

// Encrypt pg_dump stdout directly. No plaintext dump is written to disk.
// A hard link publishes the completed archive atomically without overwriting one.
export async function encryptBackup(source, destination, passphrase) {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', keyFor(passphrase, salt), iv);
  const temporary = destination + '.' + randomBytes(8).toString('hex') + '.partial';
  async function* chunks() {
    yield Buffer.concat([HEADER, salt, iv]);
    for await (const chunk of source) yield cipher.update(chunk);
    yield cipher.final();
    yield cipher.getAuthTag();
  }
  try {
    await pipeline(Readable.from(chunks()), createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
    await link(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

// Only pass decrypted contents to pg_restore --list for archive inspection.
// Do not restore Production from this function.
export async function decryptBackup(sourcePath, destination, passphrase) {
  const size = (await stat(sourcePath)).size;
  if (size <= PREFIX_LENGTH + TAG_LENGTH) throw new Error('BACKUP_FORMAT_INVALID');
  const handle = await open(sourcePath, 'r');
  let prefix;
  let tag;
  try {
    prefix = Buffer.alloc(PREFIX_LENGTH);
    tag = Buffer.alloc(TAG_LENGTH);
    const first = await handle.read(prefix, 0, prefix.length, 0);
    const last = await handle.read(tag, 0, tag.length, size - TAG_LENGTH);
    if (first.bytesRead !== prefix.length || last.bytesRead !== tag.length)
      throw new Error('BACKUP_FORMAT_INVALID');
  } finally {
    await handle.close();
  }
  if (!prefix.subarray(0, HEADER.length).equals(HEADER)) throw new Error('BACKUP_FORMAT_INVALID');
  const salt = prefix.subarray(HEADER.length, HEADER.length + SALT_LENGTH);
  const iv = prefix.subarray(HEADER.length + SALT_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', keyFor(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  async function* chunks() {
    const encrypted = createReadStream(sourcePath, { start: PREFIX_LENGTH, end: size - TAG_LENGTH - 1 });
    for await (const chunk of encrypted) yield decipher.update(chunk);
    yield decipher.final();
  }
  await pipeline(Readable.from(chunks()), destination);
}
