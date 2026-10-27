import { describe, expect, it } from 'vitest';
import { simularCompra, valorDaParcela } from './simulador';
import { parametros, situacao } from './fixturesTeste';

describe('simulador de compra', () => {
  it('parcela arredonda para cima', () => {
    expect(valorDaParcela(1000, 3)).toBe(334);
    expect(valorDaParcela(900, 3)).toBe(300);
  });

  it('cai na fatura certa e mostra a folga mês a mês', () => {
    // Compra depois do fechamento (dia 5) → 1ª parcela na fatura de fev.
    const r = simularCompra(situacao(), parametros(), { valorCentavos: 30000, parcelas: 3, forma: 'cartao', data: '2027-01-10' });
    expect(r.primeiraCompetencia).toBe('2027-02');
    expect(r.vencimentoPrimeira).toBe('2027-02-12');
    expect(r.linhas.map(l => l.mes)).toEqual(['2027-02', '2027-03', '2027-04']);
    expect(r.linhas[0]!.folgaDepoisCentavos).toBe(r.linhas[0]!.folgaAntesCentavos - 10000);
    expect(r.cabe).toBe(true);
    expect(r.comeDaMetaCentavos).toBe(0);
  });

  it('quando não cabe, diz quanto come da meta', () => {
    // Fev: disponível R$ 2.400 − meta R$ 2.000 = R$ 400 < margem R$ 500 → meta cai R$ 100.
    const r = simularCompra(situacao(), parametros(), { valorCentavos: 300000, parcelas: 3, forma: 'cartao', data: '2027-01-10' });
    expect(r.cabe).toBe(false);
    expect(r.comeDaMetaCentavos).toBe(10000);
    expect(r.mesesQueComemMeta).toBe(1);
  });

  it('compra grande atrasa as metas', () => {
    const r = simularCompra(situacao(), parametros(), { valorCentavos: 2400000, parcelas: 12, forma: 'cartao', data: '2027-01-10' });
    expect(r.atrasos.sonho).toBeGreaterThan(0);
  });

  it('sugere comprar logo depois do fechamento', () => {
    const r = simularCompra(situacao(), parametros(), { valorCentavos: 30000, parcelas: 1, forma: 'cartao', data: '2027-01-03' });
    expect(r.primeiraCompetencia).toBe('2027-01');
    expect(r.melhorDia).toBe('2027-01-06');
    expect(r.primeiraCompetenciaNoMelhorDia).toBe('2027-02');
  });

  it('Pix sai no mês da compra, de uma vez', () => {
    const r = simularCompra(situacao(), parametros(), { valorCentavos: 50000, parcelas: 6, forma: 'pix', data: '2027-01-10' });
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]!.mes).toBe('2027-01');
    expect(r.linhas[0]!.parcelaCentavos).toBe(50000);
    expect(r.melhorDia).toBeNull();
  });
});
