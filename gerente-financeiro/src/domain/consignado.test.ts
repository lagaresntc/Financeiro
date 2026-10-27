import { describe, expect, it } from 'vitest';
import type { ConsignadoCfg, EstadoConsignado } from './tipos';
import { antecipar, custoParcela, pagarFolha, parcelasAbertas, quitado, saldoNominal, saldoParaQuitar } from './consignado';

// Contrato fictício: parcela de R$ 100, 2% ao mês, k = 100 (custo = nominal quando t = m).
const cfg: ConsignadoCfg = { parcelaCentavos: 10000, k: 100, base: 1.02, mesBase: '2026-01' };
const estado: EstadoConsignado = { menorAberta: 3, maiorAberta: 10, nominalMaiorCentavos: 10000 };

describe('custo de antecipação', () => {
  it('parcela do próprio mês custa o nominal', () => {
    expect(custoParcela(cfg, 0, '2026-01')).toBe(10000);
    expect(custoParcela(cfg, 5, '2026-06')).toBe(10000);
  });

  it('parcelas mais distantes custam menos (desconto composto)', () => {
    expect(custoParcela(cfg, 1, '2026-01')).toBe(Math.round(10000 / 1.02));
    expect(custoParcela(cfg, 10, '2026-01')).toBe(Math.round(10000 / 1.02 ** 10));
    expect(custoParcela(cfg, 10, '2026-01')).toBeLessThan(custoParcela(cfg, 9, '2026-01'));
  });

  it('parcela parcial custa proporcional', () => {
    const cheia = custoParcela(cfg, 10, '2026-01');
    expect(custoParcela(cfg, 10, '2026-01', 5000)).toBe(Math.round(cheia / 2));
  });

  it('saldo para quitar é a soma dos custos', () => {
    let soma = 0;
    for (let t = 3; t <= 10; t++) soma += custoParcela(cfg, t, '2026-01');
    expect(saldoParaQuitar(cfg, estado, '2026-01')).toBe(soma);
    expect(saldoNominal(cfg, estado)).toBe(80000);
  });
});

describe('antecipar de trás pra frente', () => {
  it('quita da maior para a menor e abate parte da próxima com o resto', () => {
    const c10 = custoParcela(cfg, 10, '2026-01');
    const c9 = custoParcela(cfg, 9, '2026-01');
    const r = antecipar(cfg, estado, '2026-01', c10 + c9 + 1000);
    expect(r.quitadas).toEqual({ de: 10, ate: 9 });
    expect(r.estado.maiorAberta).toBe(8);
    expect(r.pagoCentavos).toBe(c10 + c9 + 1000);
    const c8 = custoParcela(cfg, 8, '2026-01');
    expect(r.abatidoParcialCentavos).toBe(Math.floor((10000 * 1000) / c8));
    expect(r.estado.nominalMaiorCentavos).toBe(10000 - r.abatidoParcialCentavos);
  });

  it('nunca paga mais que o saldo para quitar', () => {
    const saldo = saldoParaQuitar(cfg, estado, '2026-01');
    const r = antecipar(cfg, estado, '2026-01', saldo + 50000);
    expect(quitado(r.estado)).toBe(true);
    expect(r.pagoCentavos).toBe(saldo);
  });

  it('valor menor que uma parcela só abate parte dela', () => {
    const r = antecipar(cfg, estado, '2026-01', 100);
    expect(r.quitadas).toBeNull();
    expect(r.estado.maiorAberta).toBe(10);
    expect(r.estado.nominalMaiorCentavos).toBeLessThan(10000);
  });
});

describe('desconto em folha', () => {
  it('paga a menor parcela aberta', () => {
    const r = pagarFolha(cfg, estado);
    expect(r.descontadoCentavos).toBe(10000);
    expect(r.estado.menorAberta).toBe(4);
    expect(parcelasAbertas(r.estado)).toBe(7);
  });

  it('se só sobra a parcela parcial, desconta o que resta dela e quita', () => {
    const ultimo: EstadoConsignado = { menorAberta: 7, maiorAberta: 7, nominalMaiorCentavos: 3000 };
    const r = pagarFolha(cfg, ultimo);
    expect(r.descontadoCentavos).toBe(3000);
    expect(quitado(r.estado)).toBe(true);
  });
});
