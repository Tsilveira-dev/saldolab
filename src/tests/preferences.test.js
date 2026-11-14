import { describe, expect, it } from 'vitest';
import { readPreferences, savePreferences } from '../repositories/preferencesRepository';
import { storageKey } from '../repositories/localRepository';

describe('preferências pessoais e compatibilidade com dados antigos', () => {
  it('inicia no espaço pessoal quando não há preferência salva', () => {
    expect(readPreferences()).toEqual({ mode: 'personal', theme: 'light' });
  });

  it('abre o espaço pessoal sem apagar os dados de demonstração existentes', () => {
    const oldData = '{"version":1,"accounts":[{"id":"example"}]}';
    window.localStorage.setItem(storageKey('demo'), oldData);
    window.localStorage.setItem(
      'saldolab:preferences:v1',
      JSON.stringify({ mode: 'demo', theme: 'dark' }),
    );

    expect(readPreferences()).toEqual({ mode: 'personal', theme: 'dark' });
    expect(window.localStorage.getItem(storageKey('demo'))).toBe(oldData);
  });

  it('recupera preferências inválidas sem sobrescrever registros financeiros', () => {
    const personalData = '{"version":1,"accounts":[]}';
    window.localStorage.setItem(storageKey('personal'), personalData);
    window.localStorage.setItem('saldolab:preferences:v1', '{invalid');

    expect(readPreferences()).toEqual({ mode: 'personal', theme: 'light' });
    expect(window.localStorage.getItem(storageKey('personal'))).toBe(personalData);
  });

  it('preserva a aparência escolhida quando salva preferências', () => {
    savePreferences({ mode: 'personal', theme: 'dark' });

    expect(readPreferences()).toEqual({ mode: 'personal', theme: 'dark' });
  });

  it('não abre a nuvem sem configuração explícita de autenticação', () => {
    window.localStorage.setItem(
      'saldolab:preferences:v1',
      JSON.stringify({ mode: 'cloud', theme: 'light' }),
    );

    expect(readPreferences().mode).toBe(import.meta.env.VITE_NEON_AUTH_URL ? 'cloud' : 'personal');
  });
});
