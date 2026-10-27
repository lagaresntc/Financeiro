import { describe, expect, it } from 'vitest';
import { projetar, ID_CONSIGNADO, ID_INVESTIMENTOS } from './projecao';
import { quantoGuardar } from './quantoGuardar';
import { parametros, situacao } from './fixturesTeste';

describe('projeção mês a mês', () => {
  it('renda − saídas − variável − meta = folga', () => {
    const [jan] = projetar(situacao(), parametros(), { horizonteMeses: 1 }).meses;
    expect(jan!.rendaCentavos).toBe(600000);
    expect(jan!.saidasCentavos).toBe(100000 + 10000); // aluguel + parcela 2/3
    expect(jan!.variavelCentavos).toBe(150000);
    expect(jan!.metaCentavos).toBe(200000);
    expect(jan!.folgaCentavos).toBe(600000 - 110000 - 150000 - 200000);
  });

  it('parcelas acabam na última', () => {
    const meses = projetar(situacao(), parametros(), { horizonteMeses: 3 }).meses;
    expect(meses.map(m => m.parcelasCentavos)).toEqual([10000, 10000, 0]);
  });

  it('meta vai primeiro para a reserva, depois para o consignado', () => {
    const [jan] = projetar(situacao(), parametros(), { horizonteMeses: 1 }).meses;
    expect(jan!.aportes.reserva).toBe(100000);
    expect(jan!.aportes[ID_CONSIGNADO]).toBe(100000);
  });

  it('extra do mês entra na meta (abono em março)', () => {
    const meses = projetar(situacao(), parametros(), { horizonteMeses: 3 }).meses;
    expect(meses[2]!.metaCentavos).toBe(300000);
  });

  it('extra com 0% não vai para o plano', () => {
    const p = parametros();
    p.extras.abono = { pct: 0 };
    const meses = projetar(situacao(), p, { horizonteMeses: 3 }).meses;
    expect(meses[2]!.metaCentavos).toBe(200000);
  });

  it('meta do mês pode ser trocada (exceção por mês)', () => {
    const p = parametros();
    p.metaPorMes['2027-02'] = 50000;
    const meses = projetar(situacao(), p, { horizonteMeses: 2 }).meses;
    expect(meses[1]!.metaCentavos).toBe(50000);
  });

  it('"sobra" guarda tudo acima da margem mínima', () => {
    const p = parametros();
    p.metaPorMes['2027-01'] = 'sobra';
    const [jan] = projetar(situacao(), p, { horizonteMeses: 1 }).meses;
    expect(jan!.folgaCentavos).toBe(50000);
    expect(jan!.metaCentavos).toBe(600000 - 110000 - 150000 - 50000);
  });

  it('corta a meta para manter a margem mínima e avisa', () => {
    const p = parametros();
    p.metaMensalCentavos = 400000;
    const [jan] = projetar(situacao(), p, { horizonteMeses: 1 }).meses;
    expect(jan!.metaPlanejadaCentavos).toBe(400000);
    expect(jan!.folgaCentavos).toBe(50000);
    expect(jan!.metaCentavos).toBe(600000 - 110000 - 150000 - 50000);
    expect(jan!.avisos.length).toBe(1);
  });

  it('quita o consignado e libera a parcela no salário do mês seguinte', () => {
    const proj = projetar(situacao(), parametros(), { horizonteMeses: 12 });
    const quitacao = proj.datas[ID_CONSIGNADO]!;
    expect(quitacao).toBeDefined();
    const i = proj.meses.findIndex(m => m.mes === quitacao);
    expect(proj.meses[i]!.rendas.some(r => r.id === 'consignado-liberado')).toBe(false);
    expect(proj.meses[i + 1]!.rendas.some(r => r.id === 'consignado-liberado')).toBe(true);
    expect(proj.meses[i + 1]!.rendaCentavos).toBe(600000 + 50000);
  });

  it('depois de todas as metas, o resto vai para investimentos', () => {
    const proj = projetar(situacao(), parametros(), { horizonteMeses: 24 });
    expect(proj.datas.sonho).toBeDefined();
    const ultimo = proj.meses[proj.meses.length - 1]!;
    expect(ultimo.saldos.sonho).toBe(1000000);
    expect(ultimo.saldos[ID_INVESTIMENTOS]).toBeGreaterThan(0);
  });

  it('guardar menos atrasa as datas', () => {
    const normal = projetar(situacao(), parametros(), { horizonteMeses: 36 });
    const p = parametros();
    p.metaMensalCentavos = 100000;
    const apertado = projetar(situacao(), p, { horizonteMeses: 36 });
    expect(apertado.datas.sonho! > normal.datas.sonho!).toBe(true);
    expect(apertado.datas[ID_CONSIGNADO]! >= normal.datas[ID_CONSIGNADO]!).toBe(true);
    expect(apertado.jurosConsignadoCentavos).toBeGreaterThan(normal.jurosConsignadoCentavos);
  });

  it('rende na Caixinha até o limite e o resto em LCI', () => {
    const s = situacao();
    s.saldosMetas = { reserva: 100000, sonho: 1500000 };
    const p = parametros();
    p.premissas.cdiAnual = 0.12;
    p.premissas.caixinhaLimiteCentavos = 1000000;
    const [jan] = projetar(s, p, { horizonteMeses: 1 }).meses;
    const tc = Math.pow(1 + 0.12 * 1.2, 1 / 12) - 1;
    const tl = Math.pow(1 + 0.12 * 0.9, 1 / 12) - 1;
    const esperado = Math.round(100000 * tc) + Math.round(900000 * tc + 600000 * tl);
    expect(jan!.rendimentoCentavos).toBe(esperado);
  });

  it('é rápida: 60 meses em menos de 50 ms', () => {
    const s = situacao();
    const p = parametros();
    projetar(s, p);
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) projetar(s, p, { horizonteMeses: 60 });
    expect((performance.now() - t0) / 10).toBeLessThan(50);
  });
});

describe('quanto guardar (meta por data)', () => {
  it('acha a menor meta mensal que deixa a meta pronta na data', () => {
    const s = situacao();
    const p = parametros();
    const alvo = '2027-12';
    const r = quantoGuardar(s, p, 'sonho', alvo);
    expect(r.possivel).toBe(true);
    if (!r.possivel) return;
    expect(r.mesPronto <= alvo).toBe(true);
    const umReaisAMenos = projetar(s, { ...p, metaMensalCentavos: r.metaMensalCentavos - 100 }, { horizonteMeses: 12 });
    expect(umReaisAMenos.datas.sonho === undefined || umReaisAMenos.datas.sonho > alvo).toBe(true);
  });

  it('avisa quando é impossível e mostra os meses que travam', () => {
    const r = quantoGuardar(situacao(), parametros(), 'sonho', '2027-03');
    expect(r.possivel).toBe(false);
    if (r.possivel) return;
    expect(r.mesesTravados.length).toBeGreaterThan(0);
    expect(r.faltaNaDataCentavos).toBeGreaterThan(0);
  });
});
