import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BancoFinanceiro, type LancamentoDb } from './schema';
import { carregarSituacao, gastosDoCiclo, mesInicialDe, totalDaFatura, cartaoCfg } from './situacao';
import { cicloDoDia } from '../domain/ciclo';

let db: BancoFinanceiro;
const base: Omit<LancamentoDb, 'data' | 'valorCentavos' | 'descricao'> = { forma: 'roxo', categoria: 'Mercado', parcelas: 1, parcelaInicial: 1, origem: 'manual' };

beforeEach(async () => {
  db = new BancoFinanceiro(`teste-${Math.random()}`);
  await db.cartoes.add({ id: 'roxo', nome: 'Roxo', diaFechamento: 5, diaVencimento: 12, principal: true });
  await db.lancamentos.bulkAdd([
    { ...base, data: '2027-01-10', valorCentavos: 10000, descricao: 'Sofá', parcelas: 3 },
    { ...base, data: '2027-01-10', valorCentavos: 5000, descricao: 'Mercado' },
    { ...base, data: '2027-01-20', valorCentavos: 2000, descricao: 'Fone', parcelas: 2 },
    { ...base, data: '2027-01-11', valorCentavos: 9000, descricao: 'Aluguel', forma: 'pix', fixaId: 'aluguel' },
    { ...base, data: '2027-02-10', valorCentavos: 7000, descricao: 'Fora do ciclo' },
  ]);
  await db.faturas.add({ cartaoId: 'roxo', competencia: '2027-02', status: 'aberta', saldoInformadoCentavos: 80000, dataInformado: '2027-01-15' });
  await db.consignado.add({
    contrato: 'c', banco: 'Banco', totalParcelas: 24, taxaMes: 0.02, estadoEm: '2026-12',
    cfg: { parcelaCentavos: 30000, k: 300, base: 1.02, mesBase: '2026-12' },
    estado: { menorAberta: 2, maiorAberta: 24, nominalMaiorCentavos: 30000 },
  });
  await db.metas.add({ id: 'reserva', nome: 'Reserva', saldoCentavos: 12345, ordem: 1 });
  await db.eventos.bulkAdd([
    { data: '2027-03-10', titulo: 'IPVA', valorCentavos: 90000, tipo: 'saida' },
    { data: '2026-11-10', titulo: 'Passado', valorCentavos: 100, tipo: 'saida' },
    { data: '2027-03-10', titulo: 'Só lembrete', tipo: 'lembrete' },
  ]);
});
afterEach(async () => { await db.delete(); });

describe('mês inicial', () => {
  it('começa no mês seguinte à data de referência do seed', () => {
    expect(mesInicialDe('2026-10-27', '2026-10-27')).toBe('2026-11');
    expect(mesInicialDe('2026-12-01', '2026-10-27')).toBe('2026-12');
    expect(mesInicialDe('2027-01-15')).toBe('2027-01');
  });
});

describe('carregar a situação do banco', () => {
  it('só compras parceladas viram parcelas, com a fatura certa', async () => {
    const s = await carregarSituacao(db, '2027-01-25');
    expect(s.parcelas.map(p => [p.descricao, p.competenciaParcelaAtual, p.totalParcelas])).toEqual([
      ['Sofá', '2027-02', 3],
      ['Fone', '2027-02', 2],
    ]);
  });

  it('compra lançada depois do saldo informado soma por cima da fatura informada', async () => {
    const s = await carregarSituacao(db, '2027-01-25');
    expect(s.parcelas.find(p => p.descricao === 'Sofá')!.somaNaInformada).toBe(false);
    expect(s.parcelas.find(p => p.descricao === 'Fone')!.somaNaInformada).toBe(true);
    expect(s.faturasInformadas).toEqual([{ cartaoId: 'roxo', competencia: '2027-02', valorCentavos: 80000 }]);
  });

  it('avança o consignado pelo desconto em folha dos meses que passaram', async () => {
    const s = await carregarSituacao(db, '2027-01-25');
    expect(s.consignado.menorAberta).toBe(3);
  });

  it('traz saldos das metas e só as saídas futuras com valor', async () => {
    const s = await carregarSituacao(db, '2027-01-25');
    expect(s.saldosMetas).toEqual({ reserva: 12345 });
    expect(s.eventosConhecidos.map(e => e.descricao)).toEqual(['IPVA']);
  });

  it('fatura paga deixa de valer como informada', async () => {
    await db.faturas.where('competencia').equals('2027-02').modify({ status: 'paga' });
    const s = await carregarSituacao(db, '2027-01-25');
    expect(s.faturasInformadas).toEqual([]);
  });
});

describe('ciclo e faturas a partir dos lançamentos', () => {
  it('gastos do ciclo: só à vista, fora contas fixas e fora do ciclo', async () => {
    const g = gastosDoCiclo(await db.lancamentos.toArray(), cicloDoDia('2027-01-25'));
    expect(g.total).toBe(5000);
    expect(g.porCategoria).toEqual({ Mercado: 5000 });
  });

  it('total da fatura: saldo informado + lançado depois dele', async () => {
    const cartao = cartaoCfg((await db.cartoes.get('roxo'))!);
    const lancs = await db.lancamentos.toArray();
    const fatura = (await db.faturas.toArray())[0];
    expect(totalDaFatura(cartao, '2027-02', lancs, fatura)).toBe(80000 + 2000);
    // Sem saldo informado: soma das parcelas e compras que caem na fatura.
    expect(totalDaFatura(cartao, '2027-02', lancs)).toBe(10000 + 5000 + 2000);
    expect(totalDaFatura(cartao, '2027-04', lancs)).toBe(10000);
  });
});
