import { describe, expect, it } from 'vitest';
import { orcamentoParaCartoes, tetosDasFaturas } from './tetoFatura';
import { projetar } from './projecao';
import { parametros, situacao } from './fixturesTeste';

describe('teto das faturas', () => {
  // Fixture, jan/2027: renda R$ 6.000, aluguel R$ 1.000 no Pix, meta R$ 2.000, margem R$ 500.
  const p = parametros();
  const proj = projetar(situacao(), p, { horizonteMeses: 6 });

  it('o mês comporta renda − contas fora do cartão − meta − margem', () => {
    expect(orcamentoParaCartoes(proj, p, '2027-01', new Set(['cartao']))).toBe(600000 - 100000 - 200000 - 50000);
  });

  it('conta paga no cartão não sai do orçamento (já está na fatura)', () => {
    const q = parametros();
    q.fixas[0]!.forma = 'cartao';
    const pr = projetar(situacao(), q, { horizonteMeses: 2 });
    expect(orcamentoParaCartoes(pr, q, '2027-01', new Set(['cartao']))).toBe(600000 - 200000 - 50000);
  });

  it('o teto de um cartão desconta o que os outros já têm na mesma competência', () => {
    const total = (id: string) => (id === 'a' ? 80000 : 50000);
    const [a, b] = tetosDasFaturas(proj, p, [{ cartaoId: 'a', competencia: '2027-01' }, { cartaoId: 'b', competencia: '2027-01' }], ['a', 'b'], total);
    expect(a!.tetoCentavos).toBe(250000 - 50000);
    expect(a!.restaCentavos).toBe(250000 - 50000 - 80000);
    expect(b!.tetoCentavos).toBe(250000 - 80000);
  });

  it('mês de "guardar tudo o que sobrar" não reserva meta', () => {
    const q = parametros();
    q.metaPorMes['2027-01'] = 'sobra';
    const pr = projetar(situacao(), q, { horizonteMeses: 2 });
    expect(orcamentoParaCartoes(pr, q, '2027-01', new Set(['cartao']))).toBe(600000 - 100000 - 50000);
  });

  it('fora da projeção não tem teto', () => {
    expect(tetosDasFaturas(proj, p, [{ cartaoId: 'a', competencia: '2030-01' }], ['a'], () => 0)).toEqual([]);
  });
});
