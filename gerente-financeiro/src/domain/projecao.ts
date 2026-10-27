import type {
  Centavos, ChaveExtra, EstadoConsignado, EventoPlano, Mes, ParametrosPlano, Renda, SituacaoAtual,
} from './tipos';
import { mesDe, mesesEntre, partesMes, somarMeses } from './datas';
import { formatarReais, porcentagem, somar } from './dinheiro';
import { antecipar, pagarFolha, quitado, saldoParaQuitar } from './consignado';

export const ID_CONSIGNADO = 'consignado';
export const ID_INVESTIMENTOS = 'investimentos';

export interface LinhaRenda { id: string; nome: string; valorCentavos: Centavos }

export interface MesProjetado {
  mes: Mes;
  rendas: LinhaRenda[];
  rendaCentavos: Centavos;
  fixasCentavos: Centavos;
  parcelasCentavos: Centavos;
  faturasInformadasCentavos: Centavos;
  eventosSaidaCentavos: Centavos;
  variavelCentavos: Centavos;
  saidasCentavos: Centavos;
  /** Meta pedida pelo plano (antes de qualquer corte pela margem). */
  metaPlanejadaCentavos: Centavos;
  /** Meta que de fato vai para o plano. */
  metaCentavos: Centavos;
  /** O que sobra depois de saídas, orçamento variável e meta. */
  folgaCentavos: Centavos;
  /** Quanto foi para cada destino neste mês (metaId → centavos). */
  aportes: Record<string, Centavos>;
  rendimentoCentavos: Centavos;
  /** Saldo de cada meta no fim do mês (para o consignado: saldo para quitar). */
  saldos: Record<string, Centavos>;
  consignadoParcelasAbertas: number;
  avisos: string[];
}

export interface Projecao {
  meses: MesProjetado[];
  /** metaId → mês em que a meta fica pronta (consignado: mês em que é quitado). */
  datas: Record<string, Mes>;
  /** Tudo o que ainda vai sair para o consignado menos o saldo para quitar hoje. */
  jurosConsignadoCentavos: Centavos;
  totalPagoConsignadoCentavos: Centavos;
}

function noPeriodo(mes: Mes, inicio?: string, fim?: string): boolean {
  if (inicio && mes < inicio.slice(0, 7)) return false;
  if (fim && mes > fim.slice(0, 7)) return false;
  return true;
}

function valorDaRendaNoMes(r: Renda, mes: Mes): Centavos {
  if (!noPeriodo(mes, r.inicio, r.fim)) return 0;
  const [, m] = partesMes(mes);
  switch (r.regra.tipo) {
    case 'mensal': return r.valorCentavos;
    case 'meses': return r.regra.meses.includes(m) ? r.valorCentavos : 0;
    case 'unica': return r.regra.mes === mes ? r.valorCentavos : 0;
    case 'datas': return r.regra.datas.filter(d => mesDe(d) === mes).length * r.valorCentavos;
  }
}

function rendasDoMes(rendas: Renda[], mes: Mes): (LinhaRenda & { extra?: ChaveExtra })[] {
  const substituidas = new Set<string>();
  for (const r of rendas) {
    if (r.regra.tipo === 'unica' && r.regra.mes === mes) r.regra.substitui?.forEach(id => substituidas.add(id));
  }
  return rendas
    .filter(r => !substituidas.has(r.id))
    .map(r => ({ id: r.id, nome: r.nome, valorCentavos: valorDaRendaNoMes(r, mes), extra: r.extra }))
    .filter(r => r.valorCentavos > 0);
}

/** Rendimento mensal equivalente a pct do CDI anual. */
function taxaMensal(cdiAnual: number, pctCdi: number): number {
  return Math.pow(1 + cdiAnual * pctCdi, 1 / 12) - 1;
}

export interface OpcoesProjecao {
  /** Quantos meses projetar (padrão 60). */
  horizonteMeses?: number;
}

/**
 * Projeção mês a mês. Função pura: mesma entrada, mesma saída.
 *
 * Ordem dentro de cada mês:
 *  1. Folha desconta a menor parcela do consignado (a partir do 2º mês; a situação atual já
 *     considera o desconto do mês inicial).
 *  2. Rendimento dos fundos sobre o saldo do início do mês.
 *  3. Renda − saídas − orçamento variável − meta = folga. Se a folga ficar abaixo da margem
 *     mínima, a meta é cortada até a margem.
 *  4. A meta é distribuída pelos destinos, na ordem.
 *  5. Consignado quitado → a parcela volta para o salário a partir do mês seguinte.
 */
export function projetar(
  situacao: SituacaoAtual,
  parametros: ParametrosPlano,
  opcoes: OpcoesProjecao = {},
): Projecao {
  const horizonte = opcoes.horizonteMeses ?? 60;
  const p = parametros;
  const cfgC = situacao.consignadoCfg;
  const destinos = [...p.destinos].sort((a, b) => a.ordem - b.ordem);
  const cartoesIds = new Set(situacao.cartoes.map(c => c.id));
  const totalVariavel = somar(Object.values(p.orcamentoVariavel));
  const taxaCaixinha = taxaMensal(p.premissas.cdiAnual, p.premissas.caixinhaPctCdi);
  const taxaLci = taxaMensal(p.premissas.cdiAnual, p.premissas.lciPctCdi);
  const eventos: EventoPlano[] = [...situacao.eventosConhecidos, ...p.eventos];

  let consignado: EstadoConsignado = { ...situacao.consignado };
  const saldoInicialConsignado = saldoParaQuitar(cfgC, consignado, situacao.mesInicial);
  let totalPagoConsignado = 0;
  let mesQuitacao: Mes | null = quitado(consignado) ? somarMeses(situacao.mesInicial, -1) : null;

  const saldos: Record<string, Centavos> = {};
  for (const d of destinos) if (d.metaId !== ID_CONSIGNADO) saldos[d.metaId] = situacao.saldosMetas[d.metaId] ?? 0;
  saldos[ID_INVESTIMENTOS] ??= situacao.saldosMetas[ID_INVESTIMENTOS] ?? 0;

  const datas: Record<string, Mes> = {};
  if (mesQuitacao) datas[ID_CONSIGNADO] = mesQuitacao;
  for (const d of destinos) {
    if (d.metaId !== ID_CONSIGNADO && d.alvoCentavos !== undefined && (saldos[d.metaId] ?? 0) >= d.alvoCentavos) {
      datas[d.metaId] = somarMeses(situacao.mesInicial, -1);
    }
  }

  const meses: MesProjetado[] = [];

  for (let i = 0; i < horizonte; i++) {
    const mes = somarMeses(situacao.mesInicial, i);
    const avisos: string[] = [];

    // 1. folha
    if (i > 0 && !quitado(consignado)) {
      const r = pagarFolha(cfgC, consignado);
      consignado = r.estado;
      totalPagoConsignado += r.descontadoCentavos;
      if (quitado(consignado)) {
        mesQuitacao = mes;
        datas[ID_CONSIGNADO] ??= mes;
      }
    }

    // 2. rendimento (Caixinha até o limite, na ordem dos destinos; o resto em LCI/LCA)
    let limiteCaixinha = p.premissas.caixinhaLimiteCentavos;
    let rendimento = 0;
    for (const id of [...destinos.map(d => d.metaId).filter(id => id !== ID_CONSIGNADO), ID_INVESTIMENTOS]) {
      const saldo = saldos[id] ?? 0;
      if (saldo <= 0) continue;
      const naCaixinha = Math.min(saldo, Math.max(0, limiteCaixinha));
      limiteCaixinha -= naCaixinha;
      const r = Math.round(naCaixinha * taxaCaixinha + (saldo - naCaixinha) * taxaLci);
      saldos[id] = saldo + r;
      rendimento += r;
    }

    // 3. renda e saídas
    const rendas = rendasDoMes(p.rendas, mes);
    const eventosDoMes = eventos.filter(e => mesDe(e.data) === mes);
    const entradasEventos = eventosDoMes.filter(e => e.tipo === 'entrada');
    const liberado = mesQuitacao !== null && mes > mesQuitacao ? cfgC.parcelaCentavos : 0;
    const linhasRenda: LinhaRenda[] = [
      ...rendas.map(({ id, nome, valorCentavos }) => ({ id, nome, valorCentavos })),
      ...entradasEventos.map(e => ({ id: `evento:${e.descricao}`, nome: e.descricao, valorCentavos: e.valorCentavos })),
      ...(liberado ? [{ id: 'consignado-liberado', nome: 'Parcela do consignado liberada', valorCentavos: liberado }] : []),
    ];
    const renda = somar(linhasRenda.map(l => l.valorCentavos));

    const informadas = situacao.faturasInformadas.filter(f => f.competencia === mes);
    const cartoesInformados = new Set(informadas.map(f => f.cartaoId));
    const faturasInformadas = somar(informadas.map(f => f.valorCentavos));
    const temInformada = informadas.length > 0;

    // Faturas informadas já trazem as fixas e parcelas daquele cartão.
    const fixas = somar(
      p.fixas
        .filter(f => noPeriodo(mes, f.inicio, f.fim))
        .filter(f => !(cartoesIds.has(f.forma) && cartoesInformados.has(f.forma)))
        .map(f => f.valorCentavos),
    );
    const parcelas = somar(
      situacao.parcelas
        .filter(pa => pa.somaNaInformada || !cartoesInformados.has(pa.cartaoId))
        .map(pa => {
          const k = pa.parcelaAtual + mesesEntre(pa.competenciaParcelaAtual, mes);
          return k >= pa.parcelaAtual && k <= pa.totalParcelas ? pa.valorParcelaCentavos : 0;
        }),
    );
    const eventosSaida = somar(eventosDoMes.filter(e => e.tipo === 'saida').map(e => e.valorCentavos));
    // No mês com faturas já informadas, o gasto variável do mês cai na fatura seguinte.
    const variavel = temInformada ? 0 : totalVariavel;
    const saidas = fixas + parcelas + faturasInformadas + eventosSaida;
    const disponivel = renda - saidas - variavel;

    // 4. meta
    const regraMeta = p.metaPorMes[mes] ?? p.metaMensalCentavos;
    const extrasValor = (chave: ChaveExtra, valor: Centavos) => porcentagem(valor, p.extras[chave]?.pct ?? 0);
    let extras = 0;
    for (const r of rendas) if (r.extra) extras += extrasValor(r.extra, r.valorCentavos);
    for (const e of entradasEventos) extras += extrasValor('vendas', e.valorCentavos);
    if (liberado) extras += extrasValor('consignadoLiberado', liberado);

    const margem = p.premissas.margemMinimaCentavos;
    let metaPlanejada: Centavos;
    if (regraMeta === 'sobra') metaPlanejada = Math.max(0, disponivel - margem);
    else if (regraMeta === '13o') metaPlanejada = extras;
    else metaPlanejada = regraMeta + extras;

    let meta = metaPlanejada;
    if (disponivel - meta < margem) {
      meta = Math.max(0, disponivel - margem);
      if (regraMeta !== 'sobra') {
        avisos.push(
          disponivel < margem
            ? `Mês no vermelho: sem guardar nada, sobram só ${formatarReais(disponivel)} (margem mínima: ${formatarReais(margem)}).`
            : `Meta cortada de ${formatarReais(metaPlanejada)} para ${formatarReais(meta)} para manter a margem mínima.`,
        );
      }
    }
    const folga = disponivel - meta;

    // 5. distribuir a meta pelos destinos
    const aportes: Record<string, Centavos> = {};
    let resto = meta;
    for (const d of destinos) {
      if (resto <= 0) break;
      if (d.metaId === ID_CONSIGNADO) {
        if (quitado(consignado)) continue;
        const r = antecipar(cfgC, consignado, mes, resto);
        consignado = r.estado;
        resto -= r.pagoCentavos;
        totalPagoConsignado += r.pagoCentavos;
        aportes[ID_CONSIGNADO] = r.pagoCentavos;
        if (quitado(consignado)) {
          mesQuitacao = mes;
          datas[ID_CONSIGNADO] ??= mes;
        }
        continue;
      }
      if (d.alvoCentavos === undefined) {
        saldos[d.metaId] = (saldos[d.metaId] ?? 0) + resto;
        aportes[d.metaId] = resto;
        resto = 0;
        break;
      }
      const falta = Math.max(0, d.alvoCentavos - (saldos[d.metaId] ?? 0));
      const vai = Math.min(falta, resto);
      if (vai > 0) {
        saldos[d.metaId] = (saldos[d.metaId] ?? 0) + vai;
        aportes[d.metaId] = vai;
        resto -= vai;
      }
    }
    if (resto > 0) {
      saldos[ID_INVESTIMENTOS] = (saldos[ID_INVESTIMENTOS] ?? 0) + resto;
      aportes[ID_INVESTIMENTOS] = (aportes[ID_INVESTIMENTOS] ?? 0) + resto;
    }

    for (const d of destinos) {
      if (d.metaId === ID_CONSIGNADO || d.alvoCentavos === undefined || datas[d.metaId]) continue;
      if ((saldos[d.metaId] ?? 0) >= d.alvoCentavos) datas[d.metaId] = mes;
    }

    meses.push({
      mes,
      rendas: linhasRenda,
      rendaCentavos: renda,
      fixasCentavos: fixas,
      parcelasCentavos: parcelas,
      faturasInformadasCentavos: faturasInformadas,
      eventosSaidaCentavos: eventosSaida,
      variavelCentavos: variavel,
      saidasCentavos: saidas,
      metaPlanejadaCentavos: metaPlanejada,
      metaCentavos: meta,
      folgaCentavos: folga,
      aportes,
      rendimentoCentavos: rendimento,
      saldos: { ...saldos, [ID_CONSIGNADO]: quitado(consignado) ? 0 : saldoParaQuitar(cfgC, consignado, mes) },
      consignadoParcelasAbertas: quitado(consignado) ? 0 : consignado.maiorAberta - consignado.menorAberta + 1,
      avisos,
    });
  }

  return {
    meses,
    datas,
    totalPagoConsignadoCentavos: totalPagoConsignado,
    jurosConsignadoCentavos: totalPagoConsignado - saldoInicialConsignado,
  };
}
