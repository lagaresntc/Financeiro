import type { CartaoCfg, Centavos, Data, ParametrosPlano } from './tipos';
import { diasEntre, formatarDiaMes, mesDe, montarMes, partesMes, somarDias } from './datas';
import { formatarReais } from './dinheiro';
import { competenciaDaCompra, datasDaFatura } from './faturas';
import { quintoDiaUtil } from './diasUteis';
import { ID_CONSIGNADO } from './projecao';

export type NivelAlerta = 'info' | 'atencao' | 'perigo';
export interface Alerta { id: string; nivel: NivelAlerta; titulo: string; texto: string }

export interface EntradaAlertas {
  hoje: Data;
  cartoes: CartaoCfg[];
  parametros: ParametrosPlano;
  podeGastarCentavos: Centavos;
  /** Gasto lançado em cada cartão na fatura que está aberta hoje. */
  gastoFaturaAbertaPorCartao: Record<string, Centavos>;
  saldosMetas: Record<string, Centavos>;
  /** Gasto do ciclo por categoria. */
  gastoPorCategoria: Record<string, Centavos>;
  eventos: { data: Data; titulo: string; valorCentavos?: Centavos }[];
  /** Antecedência dos lembretes de eventos, em dias. */
  diasLembrete?: number;
  /** metaId → nome para mostrar. */
  nomesMetas?: Record<string, string>;
}

export function gerarAlertas(e: EntradaAlertas): Alerta[] {
  const alertas: Alerta[] = [];

  // Fechamento de cartão em até 3 dias
  for (const c of e.cartoes) {
    const { fechamento } = datasDaFatura(c, competenciaDaCompra(c, e.hoje));
    const dias = diasEntre(e.hoje, fechamento);
    if (dias >= 0 && dias <= 3) {
      alertas.push({
        id: `fechamento:${c.id}`,
        nivel: 'atencao',
        titulo: `${c.nome} fecha ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`} (${formatarDiaMes(fechamento)})`,
        texto: `Até lá, ainda cabem ${formatarReais(Math.max(0, e.podeGastarCentavos))} no ciclo. Compras grandes rendem mais prazo logo depois do fechamento.`,
      });
    }
  }

  // Mensalidade do cartão (isenção por gasto ou por saldo guardado)
  for (const c of e.cartoes) {
    const is = c.isencao;
    if (!is || (is.gastoMinCentavos === undefined && is.saldoMinCentavos === undefined)) continue;
    const gasto = e.gastoFaturaAbertaPorCartao[c.id] ?? 0;
    const saldo = is.metaIdSaldo ? e.saldosMetas[is.metaIdSaldo] ?? 0 : 0;
    const okGasto = is.gastoMinCentavos !== undefined && gasto >= is.gastoMinCentavos;
    const okSaldo = is.saldoMinCentavos !== undefined && saldo >= is.saldoMinCentavos;
    if (!okGasto && !okSaldo) {
      const partes: string[] = [];
      if (is.gastoMinCentavos !== undefined) partes.push(`faltam ${formatarReais(is.gastoMinCentavos - gasto)} de gasto na fatura`);
      if (is.saldoMinCentavos !== undefined) partes.push(`ou ${formatarReais(is.saldoMinCentavos - saldo)} guardados`);
      alertas.push({
        id: `mensalidade:${c.id}`,
        nivel: 'atencao',
        titulo: `${c.nome}: risco de pagar a mensalidade de ${formatarReais(is.mensalidadeCentavos)}`,
        texto: `Para ficar isento, ${partes.join(' ')}.`,
      });
    }
  }

  // Metas que vêm antes do consignado e estão abaixo do alvo (ex.: reserva usada)
  const destinos = [...e.parametros.destinos].sort((a, b) => a.ordem - b.ordem);
  const iConsignado = destinos.findIndex(d => d.metaId === ID_CONSIGNADO);
  if (iConsignado > 0) {
    for (const d of destinos.slice(0, iConsignado)) {
      if (d.alvoCentavos === undefined) continue;
      const saldo = e.saldosMetas[d.metaId] ?? 0;
      if (saldo < d.alvoCentavos) {
        alertas.push({
          id: `repor:${d.metaId}`,
          nivel: 'info',
          titulo: `${e.nomesMetas?.[d.metaId] ?? d.metaId}: faltam ${formatarReais(d.alvoCentavos - saldo)}`,
          texto: `${e.nomesMetas?.[d.metaId] ?? d.metaId} está abaixo do alvo de ${formatarReais(d.alvoCentavos)}. O que for guardado vai para ela antes do consignado.`,
        });
      }
    }
  }

  // Categoria acima do orçamento
  for (const [cat, orcado] of Object.entries(e.parametros.orcamentoVariavel)) {
    const gasto = e.gastoPorCategoria[cat] ?? 0;
    if (orcado > 0 && gasto > orcado) {
      alertas.push({
        id: `orcamento:${cat}`,
        nivel: 'perigo',
        titulo: `${cat} passou do orçamento`,
        texto: `${formatarReais(gasto)} gastos no ciclo, para ${formatarReais(orcado)} previstos (+${formatarReais(gasto - orcado)}).`,
      });
    }
  }

  // Lembretes de eventos com valor (ex.: IPVA)
  const limite = somarDias(e.hoje, e.diasLembrete ?? 45);
  for (const ev of e.eventos) {
    if (ev.valorCentavos && ev.data >= e.hoje && ev.data <= limite) {
      alertas.push({
        id: `evento:${ev.data}:${ev.titulo}`,
        nivel: 'info',
        titulo: `${ev.titulo} em ${formatarDiaMes(ev.data)}`,
        texto: `Separe ${formatarReais(ev.valorCentavos)}.`,
      });
    }
  }

  return alertas;
}

export interface ProximoEvento { data: Data; titulo: string; valorCentavos?: Centavos; tipo: 'salario' | 'renda' | 'vencimento' | 'evento' }

/** Salários, rendas extras, vencimentos de fatura e eventos nos próximos `dias`. */
export function proximosEventos(
  hoje: Data,
  parametros: ParametrosPlano,
  cartoes: CartaoCfg[],
  eventos: { data: Data; titulo: string; valorCentavos?: Centavos }[],
  dias = 45,
): ProximoEvento[] {
  const limite = somarDias(hoje, dias);
  const lista: ProximoEvento[] = [];
  const [a, m] = partesMes(mesDe(hoje));

  for (let i = 0; i < 3; i++) {
    const mes = montarMes(a, m + i);
    const [am, mm] = partesMes(mes);
    const substituidas = new Set(parametros.rendas.flatMap(r => (r.regra.tipo === 'unica' && r.regra.mes === mes ? r.regra.substitui ?? [] : [])));
    for (const r of parametros.rendas) {
      if (substituidas.has(r.id)) continue;
      if (r.inicio && mes < r.inicio) continue;
      if (r.fim && mes > r.fim) continue;
      const diaFixo = (d: number) => `${mes}-${String(Math.min(d, 28)).padStart(2, '0')}`;
      const dataNoMes = r.dia === '5du' ? quintoDiaUtil(am, mm) : typeof r.dia === 'number' ? diaFixo(r.dia) : quintoDiaUtil(am, mm);
      const regra = r.regra;
      if (regra.tipo === 'mensal' && r.dia === '5du') {
        lista.push({ data: dataNoMes, titulo: r.nome, valorCentavos: r.valorCentavos, tipo: 'salario' });
      } else if (regra.tipo === 'mensal' && typeof r.dia === 'number') {
        lista.push({ data: dataNoMes, titulo: r.nome, valorCentavos: r.valorCentavos, tipo: 'renda' });
      } else if (regra.tipo === 'meses' && regra.meses.includes(mm)) {
        lista.push({ data: dataNoMes, titulo: r.nome, valorCentavos: r.valorCentavos, tipo: 'renda' });
      } else if (regra.tipo === 'unica' && regra.mes === mes) {
        lista.push({ data: dataNoMes, titulo: r.nome, valorCentavos: r.valorCentavos, tipo: 'salario' });
      } else if (regra.tipo === 'datas') {
        for (const d of regra.datas) if (mesDe(d) === mes) lista.push({ data: d, titulo: r.nome, valorCentavos: r.valorCentavos, tipo: 'renda' });
      }
    }
    for (const c of cartoes) {
      const { vencimento } = datasDaFatura(c, mes);
      lista.push({ data: vencimento, titulo: `Vence a fatura ${c.nome}`, tipo: 'vencimento' });
    }
  }
  for (const ev of eventos) lista.push({ data: ev.data, titulo: ev.titulo, valorCentavos: ev.valorCentavos, tipo: 'evento' });

  const vistos = new Set<string>();
  return lista
    .filter(ev => ev.data >= hoje && ev.data <= limite)
    .filter(ev => { const k = `${ev.data}|${ev.titulo}`; if (vistos.has(k)) return false; vistos.add(k); return true; })
    .sort((x, y) => x.data.localeCompare(y.data));
}
