import { describe, expect, it } from 'vitest';
import type { CartaoCfg } from './tipos';
import { competenciaDaCompra, competenciaDaParcela, datasDaFatura, diaVencimentoEm, melhorDiaDeCompra } from './faturas';

// Mesmos ciclos dos cartões do SPEC (4.1).
const fechaNoMesmoMes: CartaoCfg = { id: 'a', nome: 'Fecha 3 vence 10', diaFechamento: 3, diaVencimento: 10 };
const venceNoSeguinte: CartaoCfg = { id: 'b', nome: 'Fecha 30 vence 12', diaFechamento: 30, diaVencimento: 12 };
const mudaVencimento: CartaoCfg = {
  id: 'c', nome: 'Fecha 7 vence 14 → 12', diaFechamento: 7, diaVencimento: 14,
  vencimentos: [{ aPartirDe: '2026-12', dia: 12 }],
};

describe('em qual fatura cai a compra', () => {
  it('até o fechamento (inclusive) cai na fatura deste mês', () => {
    expect(competenciaDaCompra(fechaNoMesmoMes, '2026-11-03')).toBe('2026-11');
    expect(competenciaDaCompra(mudaVencimento, '2026-11-07')).toBe('2026-11');
  });

  it('depois do fechamento cai na próxima', () => {
    expect(competenciaDaCompra(fechaNoMesmoMes, '2026-11-04')).toBe('2026-12');
    expect(competenciaDaCompra(mudaVencimento, '2026-11-08')).toBe('2026-12');
  });

  it('vencimento menor que o fechamento: vence no mês seguinte ao fechamento', () => {
    expect(competenciaDaCompra(venceNoSeguinte, '2026-10-30')).toBe('2026-11');
    expect(competenciaDaCompra(venceNoSeguinte, '2026-10-31')).toBe('2026-12');
    expect(competenciaDaCompra(venceNoSeguinte, '2026-11-15')).toBe('2026-12');
  });

  it('fechamento no dia 30 em fevereiro vira o último dia do mês', () => {
    expect(competenciaDaCompra(venceNoSeguinte, '2027-02-28')).toBe('2027-03');
    expect(competenciaDaCompra(venceNoSeguinte, '2027-03-01')).toBe('2027-04');
    expect(datasDaFatura(venceNoSeguinte, '2027-03').fechamento).toBe('2027-02-28');
  });

  it('virada de ano', () => {
    expect(competenciaDaCompra(fechaNoMesmoMes, '2026-12-20')).toBe('2027-01');
    expect(competenciaDaCompra(venceNoSeguinte, '2026-12-31')).toBe('2027-02');
  });

  it('parcela k cai na competência inicial + k − 1', () => {
    expect(competenciaDaParcela(mudaVencimento, '2026-11-08', 1)).toBe('2026-12');
    expect(competenciaDaParcela(mudaVencimento, '2026-11-08', 4)).toBe('2027-03');
  });
});

describe('datas da fatura', () => {
  it('usa o vencimento novo a partir da mudança', () => {
    expect(diaVencimentoEm(mudaVencimento, '2026-11')).toBe(14);
    expect(diaVencimentoEm(mudaVencimento, '2026-12')).toBe(12);
    expect(datasDaFatura(mudaVencimento, '2026-11')).toEqual({ fechamento: '2026-11-07', vencimento: '2026-11-14' });
    expect(datasDaFatura(mudaVencimento, '2026-12')).toEqual({ fechamento: '2026-12-07', vencimento: '2026-12-12' });
  });

  it('cartão que vence no mês seguinte fecha no mês anterior à competência', () => {
    expect(datasDaFatura(venceNoSeguinte, '2026-12')).toEqual({ fechamento: '2026-11-30', vencimento: '2026-12-12' });
  });
});

describe('melhor dia de compra', () => {
  it('é o dia seguinte ao fechamento', () => {
    expect(melhorDiaDeCompra(mudaVencimento, '2026-11-01')).toBe('2026-11-08');
    expect(melhorDiaDeCompra(venceNoSeguinte, '2026-10-10')).toBe('2026-10-31');
    expect(melhorDiaDeCompra(venceNoSeguinte, '2026-11-10')).toBe('2026-12-01');
  });

  it('se o fechamento já passou, hoje já é um bom dia', () => {
    expect(melhorDiaDeCompra(mudaVencimento, '2026-11-20')).toBe('2026-11-20');
  });
});
