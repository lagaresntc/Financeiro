import { describe, expect, it } from 'vitest';
import { parseLinhasGenericas } from './generico';

describe('parseLinhasGenericas', () => {
  it('lê linhas com data, texto e valor', () => {
    const r = parseLinhasGenericas([
      'Resumo da fatura',
      '05/10 LOJA EXEMPLO 1.234,56',
      '06/10 OUTRA LOJA 02/04 R$ 100,00',
      '07/10 ESTORNO TESTE - 10,00',
      'CIDADE EXEMPLO',
      '20/12 LOJA DEZEMBRO 9,90',
    ], 2027, 1);
    expect(r).toEqual([
      { data: '2027-10-05', descricao: 'LOJA EXEMPLO', valorCentavos: 123456 },
      { data: '2027-10-06', descricao: 'OUTRA LOJA', valorCentavos: 10000, parcela: { k: 2, n: 4 } },
      { data: '2027-10-07', descricao: 'ESTORNO TESTE', valorCentavos: -1000 },
      { data: '2026-12-20', descricao: 'LOJA DEZEMBRO', valorCentavos: 990 },
    ].map((x, i) => (i < 3 ? { ...x, data: x.data.replace('2027', '2026') } : x)));
  });
  it('sem mês de vencimento usa o ano padrão', () => {
    expect(parseLinhasGenericas(['20/12 LOJA 1,00'], 2026)[0]?.data).toBe('2026-12-20');
  });
});
