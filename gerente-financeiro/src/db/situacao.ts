import type { BancoFinanceiro, CartaoDb, FaturaDb, LancamentoDb } from './schema';
import type { CartaoCfg, Centavos, Data, Mes, ParcelaEmAndamento, SituacaoAtual } from '../domain/tipos';
import { mesDe, mesesEntre, somarMeses } from '../domain/datas';
import { competenciaDaCompra, competenciaDaParcela } from '../domain/faturas';
import { pagarFolha } from '../domain/consignado';
import type { Ciclo } from '../domain/ciclo';

export function cartaoCfg(c: CartaoDb): CartaoCfg {
  return { id: c.id, nome: c.nome, diaFechamento: c.diaFechamento, diaVencimento: c.diaVencimento, vencimentos: c.vencimentos, isencao: c.isencao };
}

/** Competência em que cai a parcela `k` (1-based, contando da compra) de um lançamento no cartão. */
export function competenciaDoLancamento(cartao: CartaoCfg, l: LancamentoDb, k = l.parcelaInicial): Mes {
  const base = l.faturaRef ?? competenciaDaParcela(cartao, l.data, l.parcelaInicial);
  return somarMeses(base, k - l.parcelaInicial);
}

/** Mês em que a projeção começa: o mês atual, ou o seguinte à data de referência do seed. */
export function mesInicialDe(hoje: Data, dataReferencia?: Data): Mes {
  const mesHoje = mesDe(hoje);
  if (!dataReferencia) return mesHoje;
  const posRef = somarMeses(mesDe(dataReferencia), 1);
  return posRef > mesHoje ? posRef : mesHoje;
}

/** Faturas informadas valem até serem pagas; compras lançadas depois do saldo informado somam por cima. */
function lancadaDepoisDoInformado(l: LancamentoDb, comp: Mes, faturas: FaturaDb[]): boolean {
  const f = faturas.find(x => x.cartaoId === l.forma && x.competencia === comp && x.saldoInformadoCentavos !== undefined);
  return !!f && l.origem !== 'seed' && (!f.dataInformado || l.data > f.dataInformado);
}

/**
 * Monta a situação real a partir do banco. Só compras parceladas entram como parcelas na projeção:
 * compras à vista fazem parte do orçamento variável do mês.
 */
export async function carregarSituacao(db: BancoFinanceiro, hoje: Data): Promise<SituacaoAtual> {
  const [cartoesDb, faturas, lancamentos, consignados, metas, eventos, ref] = await Promise.all([
    db.cartoes.toArray(), db.faturas.toArray(), db.lancamentos.toArray(), db.consignado.toArray(),
    db.metas.toArray(), db.eventos.toArray(), db.config.get('dataReferencia'),
  ]);
  const mesInicial = mesInicialDe(hoje, ref?.valor as Data | undefined);
  const cartoes = cartoesDb.map(cartaoCfg);
  const porId = new Map(cartoes.map(c => [c.id, c]));

  const parcelas: ParcelaEmAndamento[] = [];
  for (const l of lancamentos) {
    const c = porId.get(l.forma);
    if (!c || l.parcelas <= 1) continue;
    const comp = competenciaDoLancamento(c, l);
    parcelas.push({
      cartaoId: c.id,
      descricao: l.descricao,
      valorParcelaCentavos: l.valorCentavos,
      parcelaAtual: l.parcelaInicial,
      totalParcelas: l.parcelas,
      competenciaParcelaAtual: comp,
      somaNaInformada: lancadaDepoisDoInformado(l, comp, faturas),
    });
  }

  const reg = consignados[0];
  let consignado = reg?.estado ?? { menorAberta: 1, maiorAberta: 0, nominalMaiorCentavos: 0 };
  if (reg) {
    for (let mes = somarMeses(reg.estadoEm, 1); mes <= mesInicial; mes = somarMeses(mes, 1)) {
      consignado = pagarFolha(reg.cfg, consignado).estado;
    }
  }

  const saldosMetas: Record<string, Centavos> = {};
  for (const m of metas) saldosMetas[m.id] = m.saldoCentavos;

  return {
    mesInicial,
    cartoes,
    faturasInformadas: faturas
      .filter(f => f.saldoInformadoCentavos !== undefined && f.status !== 'paga' && f.competencia >= mesInicial)
      .map(f => ({ cartaoId: f.cartaoId, competencia: f.competencia, valorCentavos: f.saldoInformadoCentavos! })),
    parcelas,
    consignadoCfg: reg?.cfg ?? { parcelaCentavos: 0, k: 0, base: 1, mesBase: mesInicial },
    consignado,
    saldosMetas,
    eventosConhecidos: eventos
      .filter(e => e.valorCentavos !== undefined && e.tipo === 'saida' && mesDe(e.data) >= mesInicial)
      .map(e => ({ data: e.data, descricao: e.titulo, valorCentavos: e.valorCentavos!, tipo: 'saida' as const })),
  };
}

export interface ItemFatura { lancamento: LancamentoDb; parcela: number; valorCentavos: Centavos }

/** Itens (compras e parcelas) que caem numa fatura, a partir dos lançamentos. */
export function itensDaFatura(cartao: CartaoCfg, comp: Mes, lancamentos: LancamentoDb[]): ItemFatura[] {
  const itens: ItemFatura[] = [];
  for (const l of lancamentos) {
    if (l.forma !== cartao.id) continue;
    const primeira = competenciaDoLancamento(cartao, l);
    const k = l.parcelaInicial + mesesEntre(primeira, comp);
    if (k >= l.parcelaInicial && k <= l.parcelas) itens.push({ lancamento: l, parcela: k, valorCentavos: l.valorCentavos });
  }
  return itens.sort((a, b) => b.lancamento.data.localeCompare(a.lancamento.data));
}

/** Total da fatura: saldo informado (se houver) + o que foi lançado depois dele; senão, a soma dos itens. */
export function totalDaFatura(cartao: CartaoCfg, comp: Mes, lancamentos: LancamentoDb[], fatura?: FaturaDb): Centavos {
  const itens = itensDaFatura(cartao, comp, lancamentos);
  if (fatura?.saldoInformadoCentavos === undefined) return itens.reduce((s, i) => s + i.valorCentavos, 0);
  const depois = itens.filter(i => i.lancamento.origem !== 'seed' && (!fatura.dataInformado || i.lancamento.data > fatura.dataInformado));
  return fatura.saldoInformadoCentavos + depois.reduce((s, i) => s + i.valorCentavos, 0);
}

/** Gastos variáveis do ciclo: compras à vista (qualquer forma), fora pagamentos de contas fixas. */
export function gastosDoCiclo(lancamentos: LancamentoDb[], ciclo: Ciclo): { total: Centavos; porCategoria: Record<string, Centavos> } {
  const porCategoria: Record<string, Centavos> = {};
  let total = 0;
  for (const l of lancamentos) {
    if (l.data < ciclo.inicio || l.data >= ciclo.fim || l.parcelas > 1 || l.fixaId) continue;
    total += l.valorCentavos;
    porCategoria[l.categoria] = (porCategoria[l.categoria] ?? 0) + l.valorCentavos;
  }
  return { total, porCategoria };
}

/** Competência da fatura que está aberta hoje em cada cartão. */
export function faturaAbertaHoje(cartao: CartaoCfg, hoje: Data): Mes {
  return competenciaDaCompra(cartao, hoje);
}
