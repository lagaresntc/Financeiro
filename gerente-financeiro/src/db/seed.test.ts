import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { BancoFinanceiro } from './schema';
import { aplicarSeed, seedJaAplicado } from './seed';
import type { DadosIniciais } from './mapearSeed';

// Arquivo mínimo e fictício, no mesmo formato do dados-iniciais.json.
const dados: DadosIniciais = {
  dataReferencia: '2027-01-15',
  config: { metaMensalCentavos: 100000, margemMinimaCentavos: 10000, cdiAnual: 0.1, caixinhaLimiteCentavos: 100000, caixinhaPctCdi: 1 },
  cartoes: [{ id: 'roxo', nome: 'Roxo', diaFechamento: 5, diaVencimento: 12, principal: true }],
  faturasAbertas: [{ cartaoId: 'roxo', competencia: '2027-02', saldoInformadoCentavos: 50000 }],
  parcelasEmAndamento: [{ cartaoId: 'roxo', descricao: 'Sofá', parcelaAtual: 2, totalParcelas: 5, valorParcelaCentavos: 20000, competenciaParcelaAtual: '2027-02' }],
  lancamentosRecentes: [{ data: '2027-01-10', forma: 'roxo', categoria: 'Mercado', descricao: 'Mercado', valorCentavos: 30000, parcelas: 3 }],
  rendas: [{ id: 'salario', nome: 'Salário', valorCentavos: 500000, regra: 'mensal', dia: '5du' }],
  fixas: [{ id: 'luz', nome: 'Luz', valorCentavos: 10000, forma: 'pix' }],
  orcamentoVariavelMensal: { Mercado: 80000 },
  consignado: {
    parcelaCentavos: 30000, totalParcelas: 24, taxaMes: 0.02,
    formulaAntecipacao: { k: 300, base: 1.02, mesBase: '2027-01' },
    parcelasPagasEmFolhaAte: 1, maiorParcelaAberta: 24, antecipacoes: [],
  },
  investimentos: [],
  metas: [{ id: 'reserva', nome: 'Reserva', alvoCentavos: 100000, saldoCentavos: 0, ordem: 1 }, { id: 'consignado', nome: 'Consignado', ordem: 2 }],
  veiculos: [],
  eventos: [{ data: '2027-02-01', titulo: 'Lembrete' }],
  cenarios: [
    {
      id: 'base', nome: 'Base', ativo: true,
      parametros: {
        metaMensalCentavos: 100000, metaPorMes: { '2027-03': '13o' }, extras: { abono: { pct: 50 } },
        destinos: [{ metaId: 'reserva', ordem: 1, alvoCentavos: 100000 }, { metaId: 'consignado', ordem: 2 }],
        eventos: [],
        premissas: { cdiAnual: 0.1, caixinhaPctCdi: 1, caixinhaLimiteCentavos: 100000, lciPctCdi: 0.9, margemMinimaCentavos: 10000 },
      },
    },
    { id: 'apertado', nome: 'Apertado', ativo: false, baseadoEm: 'base', alteracoes: { metaMensalCentavos: 50000 } },
  ],
};

let db: BancoFinanceiro;
afterEach(async () => { await db.delete(); });

describe('seed', () => {
  it('carrega tudo na primeira abertura', async () => {
    db = new BancoFinanceiro(`teste-${Math.random()}`);
    expect(await seedJaAplicado(db)).toBe(false);
    expect(await aplicarSeed(db, dados)).toBe(true);
    expect(await db.cartoes.count()).toBe(1);
    expect(await db.lancamentos.count()).toBe(2);
    expect(await db.faturas.count()).toBe(1);
    const parcelado = (await db.lancamentos.toArray()).find(l => l.descricao === 'Mercado')!;
    expect(parcelado.parcelas).toBe(3);
    expect(parcelado.valorCentavos).toBe(10000);
    const consignado = await db.consignado.get('bb');
    expect(consignado!.estado).toEqual({ menorAberta: 2, maiorAberta: 24, nominalMaiorCentavos: 30000 });
  });

  it('resolve cenários derivados (baseadoEm + alterações)', async () => {
    db = new BancoFinanceiro(`teste-${Math.random()}`);
    await aplicarSeed(db, dados);
    const apertado = await db.cenarios.get('apertado');
    expect(apertado!.parametros.metaMensalCentavos).toBe(50000);
    expect(apertado!.parametros.metaPorMes['2027-03']).toBe('13o');
    expect(apertado!.parametros.extras.abono.pct).toBe(50);
    expect(apertado!.parametros.extras.vendas.pct).toBe(100); // padrão quando o arquivo não diz
    expect(apertado!.parametros.rendas).toHaveLength(1);
  });

  it('não roda duas vezes', async () => {
    db = new BancoFinanceiro(`teste-${Math.random()}`);
    await aplicarSeed(db, dados);
    await db.lancamentos.add({ data: '2027-01-20', valorCentavos: 999, forma: 'pix', categoria: 'Outros', descricao: 'novo', parcelas: 1, parcelaInicial: 1, origem: 'manual' });
    expect(await aplicarSeed(db, dados)).toBe(false);
    expect(await db.lancamentos.count()).toBe(3);
  });
});
