import type { BancoFinanceiro, CenarioDb, LancamentoDb } from './schema';
import { TABELAS } from './schema';
import type { DadosIniciais } from './mapearSeed';
import { mapearCartoes, parametrosDoCenario, situacaoDoSeed } from './mapearSeed';

const CHAVE_SEED = 'seedAplicadoEm';

export async function seedJaAplicado(db: BancoFinanceiro): Promise<boolean> {
  return (await db.config.get(CHAVE_SEED)) !== undefined;
}

/**
 * Carrega dados-iniciais.json no banco. Só roda uma vez: depois, o que vale é o que for lançado no app.
 * Devolve false se o seed já tinha sido aplicado.
 */
export async function aplicarSeed(db: BancoFinanceiro, dados: DadosIniciais, agora = new Date()): Promise<boolean> {
  return db.transaction('rw', TABELAS.map(t => db.table(t)), async () => {
    if (await seedJaAplicado(db)) return false;
    const situacao = situacaoDoSeed(dados);
    const cartoesCfg = mapearCartoes(dados);

    await db.cartoes.bulkAdd(dados.cartoes.map(c => ({
      id: c.id,
      nome: c.nome,
      titular: c.titular,
      diaFechamento: c.diaFechamento,
      diaVencimento: c.diaVencimento,
      vencimentos: cartoesCfg.find(x => x.id === c.id)?.vencimentos,
      limiteCentavos: c.limiteCentavos,
      principal: c.principal ?? false,
      cashbackPct: c.cashbackPct,
      debitoAutomatico: c.debitoAutomatico,
      nota: c.nota,
    })));

    await db.faturas.bulkAdd(dados.faturasAbertas.map(f => ({
      cartaoId: f.cartaoId,
      competencia: f.competencia,
      status: 'aberta' as const,
      saldoInformadoCentavos: f.saldoInformadoCentavos,
      dataInformado: f.dataInformado,
    })));

    const lancamentos: LancamentoDb[] = [
      ...dados.parcelasEmAndamento.map(p => ({
        data: dados.dataReferencia,
        valorCentavos: p.valorParcelaCentavos,
        forma: p.cartaoId,
        categoria: 'Outros',
        descricao: p.descricao,
        parcelas: p.totalParcelas,
        parcelaInicial: p.parcelaAtual,
        faturaRef: p.competenciaParcelaAtual,
        origem: 'seed' as const,
      })),
      // Compras recentes parceladas que já aparecem em parcelasEmAndamento não entram de novo.
      ...dados.lancamentosRecentes.filter(l => {
        const n = l.parcelas ?? 1;
        return n === 1 || !dados.parcelasEmAndamento.some(p =>
          p.cartaoId === l.forma && p.totalParcelas === n && Math.abs(p.valorParcelaCentavos * n - l.valorCentavos) <= n);
      }).map(l => {
        const n = l.parcelas ?? 1;
        return {
          data: l.data,
          valorCentavos: Math.round(l.valorCentavos / n),
          forma: l.forma,
          categoria: l.categoria,
          descricao: l.descricao,
          parcelas: n,
          parcelaInicial: 1,
          origem: 'seed' as const,
        };
      }),
    ];
    await db.lancamentos.bulkAdd(lancamentos);


    await db.consignado.add({
      contrato: 'bb',
      banco: 'Banco do Brasil',
      cfg: situacao.consignadoCfg,
      totalParcelas: dados.consignado.totalParcelas,
      taxaMes: dados.consignado.taxaMes,
      estado: situacao.consignado,
      estadoEm: situacao.mesInicial,
    });
    await db.antecipacoes.bulkAdd(dados.consignado.antecipacoes.map(a => ({ ...a })));

    await db.metas.bulkAdd(dados.metas.map(m => ({ id: m.id, nome: m.nome, alvoCentavos: m.alvoCentavos, saldoCentavos: m.saldoCentavos ?? 0, ordem: m.ordem })));
    await db.investimentos.bulkAdd(dados.investimentos.map(i => ({ ...i })));
    await db.veiculos.bulkAdd(dados.veiculos.map(v => ({
      id: v.id, nome: v.nome, ano: v.ano, fipeCentavos: v.fipeCentavos,
      plano: v.plano === 'vender' ? 'vender' as const : 'manter' as const, status: v.status, notas: v.nota,
    })));
    await db.eventos.bulkAdd(dados.eventos.map(e => ({
      data: e.data, titulo: e.titulo, valorCentavos: e.valorCentavos, orcamentoCentavos: e.orcamentoCentavos,
      tipo: e.valorCentavos ? 'saida' : 'lembrete', nota: e.nota,
    })));

    const criadoEm = agora.toISOString();
    const cenarios: CenarioDb[] = dados.cenarios.map(c => ({
      id: c.id, nome: c.nome, ativo: c.ativo, criadoEm, parametros: parametrosDoCenario(dados, c.id),
    }));
    await db.cenarios.bulkAdd(cenarios);

    await db.config.bulkAdd([
      { chave: CHAVE_SEED, valor: criadoEm },
      { chave: 'dataReferencia', valor: dados.dataReferencia },
      { chave: 'situacaoInicial', valor: situacao },
    ]);
    return true;
  });
}
