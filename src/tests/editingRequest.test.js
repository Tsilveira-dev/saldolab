import { describe, expect, it, vi } from 'vitest';
import {
  rememberEditingRequest,
  takeEditingRequest,
  clearEditingRequest,
} from '../repositories/editingRequest';

const request = { mode: 'personal', month: '2026-10', accountId: 'a' };
function navigation(type) {
  Object.defineProperty(performance, 'getEntriesByType', {
    configurable: true,
    value: vi.fn(() => [{ type }]),
  });
}

describe('intenção de edição usada somente em uma recarga', () => {
  it('consome uma única vez e preserva o mês e filtro da consulta', () => {
    navigation('reload');
    rememberEditingRequest(request);
    expect(takeEditingRequest()).toEqual(request);
    expect(takeEditingRequest()).toBeNull();
  });
  it.each(['navigate', 'back_forward'])('não ativa ao abrir outra página ou voltar: %s', (type) => {
    navigation(type);
    rememberEditingRequest(request);
    expect(takeEditingRequest()).toBeNull();
    navigation('reload');
    expect(takeEditingRequest()).toBeNull();
  });
  it('encerrar a edição descarta a intenção de retomada', () => {
    navigation('reload');
    rememberEditingRequest(request);
    clearEditingRequest();
    expect(takeEditingRequest()).toBeNull();
  });
  it('conteúdo inválido não ativa nem interrompe a consulta', () => {
    navigation('reload');
    sessionStorage.setItem('saldolab:editing-request:v1', '{invalid');
    expect(takeEditingRequest()).toBeNull();
  });
  it('falha de sessionStorage não concede edição', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => rememberEditingRequest(request)).toThrow('blocked');
    expect(takeEditingRequest()).toBeNull();
  });
});
