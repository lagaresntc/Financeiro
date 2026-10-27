import { describe, expect, it } from 'vitest';
import { descricoesParecidas, marcarDuplicados } from './duplicados';

describe('marcarDuplicados', () => {
  const existentes = [{ data: '2026-10-05', valorCentavos: 1000, descricao: 'Loja Exemplo' }];
  it('mesma data, valor e descrição parecida', () => {
    expect(marcarDuplicados([
      { data: '2026-10-05', descricao: 'LOJA EXEMPLO CENTRO', valorCentavos: 1000 },
      { data: '2026-10-05', descricao: 'Loja Exemplo', valorCentavos: 1001 },
      { data: '2026-10-06', descricao: 'Loja Exemplo', valorCentavos: 1000 },
      { data: '2026-10-05', descricao: 'Padaria Teste', valorCentavos: 1000 },
    ], existentes)).toEqual([true, false, false, false]);
  });
  it('Jaccard', () => {
    expect(descricoesParecidas('LOJA EXEMPLO NORTE', 'LOJA EXEMPLO SUL')).toBe(true); // 2/4
    expect(descricoesParecidas('LOJA A B C', 'LOJA X Y Z')).toBe(false);
  });
});
