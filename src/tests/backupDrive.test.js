import { describe, expect, it } from 'vitest';
import { backupFilename, backupSettings, remoteChecksum } from '../../scripts/backup-drive.js';

describe('preparação do backup remoto Google Drive', () => {
  it('cria nomes únicos e ordenáveis sem informações financeiras', () => {
    const name = backupFilename(new Date('2026-11-14T12:34:56Z'), 'aabbccddeeff');
    expect(name).toBe('saldolab-20261114T123456Z-aabbccddeeff.saldolab.enc');
  });

  it('interpreta checksums de um arquivo específico e recusa respostas ambíguas', () => {
    const hash = 'a'.repeat(32);
    expect(remoteChecksum(`${hash}  backup.saldolab.enc\n`, 'backup.saldolab.enc')).toBe(hash);
    expect(() => remoteChecksum(`${hash}  wrong-name\n`, 'backup.saldolab.enc')).toThrow(
      'DRIVE_BACKUP_REMOTE_CHECKSUM_INVALID',
    );
    expect(() => remoteChecksum('no checksum', 'backup.saldolab.enc')).toThrow();
    expect(() =>
      remoteChecksum(`${hash}  backup.saldolab.enc\n${hash}  other.enc`, 'backup.saldolab.enc'),
    ).toThrow();
  });

  it('não aceita arquivos de backup dentro do projeto nem credenciais ausentes', () => {
    const values = {
      SALDOLAB_BACKUP_DATABASE_URL: 'not-a-real-connection',
      SALDOLAB_BACKUP_PASSPHRASE: 'not-a-real-secret',
    };
    expect(() => backupSettings(values)).toThrow('DRIVE_BACKUP_LOCAL_DIR_REQUIRED');
    expect(() =>
      backupSettings({ ...values, SALDOLAB_BACKUP_LOCAL_DIR: process.cwd() }),
    ).toThrow('DRIVE_BACKUP_LOCAL_DIR_MUST_BE_OUTSIDE_PROJECT');
    expect(() =>
      backupSettings({ ...values, SALDOLAB_BACKUP_LOCAL_DIR: '/tmp', SALDOLAB_DRIVE_REMOTE: 'a:b' }),
    ).toThrow('DRIVE_BACKUP_REMOTE_INVALID');
  });
});
