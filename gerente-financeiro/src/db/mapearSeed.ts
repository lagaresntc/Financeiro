// Converte o arquivo dados-iniciais.json (formato livre, escrito à mão) para os tipos do domínio.
// Função pura: usada pelo seed do Dexie, pelos testes e pelo script de relatório.
import type {
  CartaoCfg, ChaveExtra, Destino, EventoPlano, Fixa, MetaDoMes, ParametrosPlano, Renda, SituacaoAtual,
} from '../domain/tipos';
import { mesDe, somarMeses } from '../domain/datas';

/* Formato do arquivo (só o que o app usa). */
export interface DadosIniciais {
  dataReferencia: string;
  config: { metaMensalCentavos: number; margemMinimaCentavos: number; cdiAnual: number; caixinhaLimiteCentavos: number; caixinhaPctCdi: number };
  cartoes: { id: string; nome: string; diaFechamento: number; diaVencimento: number; limiteCentavos?: number; principal?: boolean; cashbackPct?: number; titular?: string; debitoAutomatico?: boolean; nota?: string }[];
  faturasAbertas: { cartaoId: string; competencia: string; saldoInformadoCentavos: number; dataInformado?: string }[];
  parcelasEmAndamento: { cartaoId: string; descricao: string; parcelaAtual: number; totalParcelas: number; valorParcelaCentavos: number; competenciaParcelaAtual: string }[];
  lancamentosRecentes: { data: string; forma: string; categoria: string; descricao: string; valorCentavos: number; parcelas?: number }[];
  rendas: { id: string; nome: string; valorCentavos: number; regra: string; dia?: number | string; meses?: number[]; datas?: string[]; data?: string; substitui?: string; inicio?: string; fim?: string; nota?: string }[];
  fixas: { id: string; nome: string; valorCentavos: number; forma: string; fim?: string; inicio?: string; nota?: string }[];
  orcamentoVariavelMensal: Record<string, number>;
  consignado: {
    parcelaCentavos: number; totalParcelas: number; taxaMes: number;
    formulaAntecipacao: { k: number; base: number; mesBase: string };
    parcelasPagasEmFolhaAte: number; maiorParcelaAberta: number;
    parcelaParcial?: { numero: number; valorCentavos: number };
    saldoEstimadoQuitacaoNov26Centavos?: number;
    antecipacoes: { data: string; valorPagoCentavos: number; deParcela: number; ateParcela: number; nota?: string }[];
  };
  outrasDividas?: unknown[];
  investimentos: { tipo: string; nome: string; valorCentavos?: number; livreCentavos?: number; taxa?: string; quantidade?: number; precoMedioCentavos?: number; limiteCentavos?: number; nota?: string }[];
  metas: { id: string; nome: string; alvoCentavos?: number; saldoCentavos?: number; ordem: number }[];
  veiculos: { id: string; nome: string; ano: number; fipeCentavos?: number; plano: string; status?: string; nota?: string }[];
  eventos: { data: string; titulo: string; valorCentavos?: number; orcamentoCentavos?: number; nota?: string }[];
  cenarios: CenarioArquivo[];
}

interface ParametrosArquivo {
  metaMensalCentavos: number;
  metaPorMes: Record<string, number | string>;
  extras: Record<string, { pct: number }>;
  destinos: { metaId: string; ordem: number; alvoCentavos?: number; ondeAplicar?: string }[];
  eventos: EventoPlano[];
  premissas: ParametrosPlano['premissas'];
}

type CenarioArquivo =
  | { id: string; nome: string; ativo: boolean; parametros: ParametrosArquivo }
  | { id: string; nome: string; ativo: boolean; baseadoEm: string; alteracoes: { metaMensalCentavos?: number; 'eventos+'?: EventoPlano[] } };

/** Rendas que entram como "extra" (vão para o plano conforme a porcentagem do cenário). */
const EXTRA_POR_RENDA: Record<string, ChaveExtra> = {
  abono: 'abono',
  '13o': 'decimoTerceiro',
  licenca: 'licenca',
};

/**
 * O contracheque único de nov/2026 já inclui o abono de fardamento (ver nota no arquivo),
 * então ele substitui o salário e também o abono daquele mês.
 */
const SUBSTITUI_TAMBEM: Record<string, string[]> = { salario: ['abono'] };

export function mapearRendas(dados: DadosIniciais): Renda[] {
  return dados.rendas.map((r): Renda => {
    const base = {
      id: r.id,
      nome: r.nome,
      valorCentavos: r.valorCentavos,
      dia: r.dia === '5du' ? ('5du' as const) : typeof r.dia === 'number' ? r.dia : undefined,
      inicio: r.inicio ? mesDe(r.inicio) : undefined,
      fim: r.fim ? mesDe(r.fim) : undefined,
      extra: EXTRA_POR_RENDA[r.id],
    };
    switch (r.regra) {
      case 'mensal': return { ...base, regra: { tipo: 'mensal' } };
      case 'meses': return { ...base, regra: { tipo: 'meses', meses: r.meses ?? [] } };
      case 'datas': return { ...base, regra: { tipo: 'datas', datas: r.datas ?? [] } };
      case 'unica': {
        const sub = r.substitui ? [r.substitui, ...(SUBSTITUI_TAMBEM[r.substitui] ?? [])] : undefined;
        return { ...base, regra: { tipo: 'unica', mes: mesDe(r.data ?? ''), substitui: sub } };
      }
      default: throw new Error(`Regra de renda desconhecida: ${r.regra}`);
    }
  });
}

/** "bb (RecargaPay) → Pix a partir de jan/2027" → 'bb'; "croma" → 'croma'. */
function formaPrincipal(forma: string, cartoesIds: Set<string>): string {
  const primeira = forma.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return cartoesIds.has(primeira) ? primeira : primeira === 'pix' ? 'pix' : 'dinheiro';
}

export function mapearFixas(dados: DadosIniciais): Fixa[] {
  const ids = new Set(dados.cartoes.map(c => c.id));
  return dados.fixas.map(f => ({
    id: f.id,
    nome: f.nome,
    valorCentavos: f.valorCentavos,
    forma: formaPrincipal(f.forma, ids),
    inicio: f.inicio ? mesDe(f.inicio) : undefined,
    fim: f.fim ? mesDe(f.fim) : undefined,
  }));
}

/** Mudanças de vencimento descritas nas notas (Croma: dia 12 a partir de dez/2026). */
const MUDANCAS_VENCIMENTO: Record<string, { aPartirDe: string; dia: number }[]> = {
  croma: [{ aPartirDe: '2026-12', dia: 12 }],
};

export function mapearCartoes(dados: DadosIniciais): CartaoCfg[] {
  return dados.cartoes.map(c => ({
    id: c.id,
    nome: c.nome,
    diaFechamento: c.diaFechamento,
    diaVencimento: c.diaVencimento,
    vencimentos: MUDANCAS_VENCIMENTO[c.id],
  }));
}

function mapearMetaPorMes(m: Record<string, number | string>): Record<string, MetaDoMes> {
  const out: Record<string, MetaDoMes> = {};
  for (const [mes, v] of Object.entries(m)) {
    if (v === '13o' || v === 'sobra') out[mes] = v;
    else if (typeof v === 'number') out[mes] = v;
    else throw new Error(`Meta do mês ${mes} inválida: ${v}`);
  }
  return out;
}

const EXTRAS_PADRAO: Record<ChaveExtra, { pct: number }> = {
  abono: { pct: 100 }, decimoTerceiro: { pct: 100 }, licenca: { pct: 100 }, vendas: { pct: 100 }, consignadoLiberado: { pct: 100 },
};

export function parametrosDoCenario(dados: DadosIniciais, cenarioId: string): ParametrosPlano {
  const c = dados.cenarios.find(x => x.id === cenarioId);
  if (!c) throw new Error(`Cenário não encontrado: ${cenarioId}`);
  if ('baseadoEm' in c) {
    const base = parametrosDoCenario(dados, c.baseadoEm);
    return {
      ...base,
      metaMensalCentavos: c.alteracoes.metaMensalCentavos ?? base.metaMensalCentavos,
      eventos: [...base.eventos, ...(c.alteracoes['eventos+'] ?? [])],
    };
  }
  const p = c.parametros;
  const destinos: Destino[] = p.destinos.map(d => ({ metaId: d.metaId, ordem: d.ordem, alvoCentavos: d.alvoCentavos }));
  return {
    metaMensalCentavos: p.metaMensalCentavos,
    metaPorMes: mapearMetaPorMes(p.metaPorMes),
    extras: { ...EXTRAS_PADRAO, ...(p.extras as Partial<Record<ChaveExtra, { pct: number }>>) },
    destinos,
    rendas: mapearRendas(dados),
    fixas: mapearFixas(dados),
    orcamentoVariavel: { ...dados.orcamentoVariavelMensal },
    eventos: p.eventos.map(e => ({ ...e })),
    premissas: { ...p.premissas },
  };
}

export function cenarioAtivoId(dados: DadosIniciais): string {
  return (dados.cenarios.find(c => c.ativo) ?? dados.cenarios[0]!).id;
}

export function situacaoDoSeed(dados: DadosIniciais): SituacaoAtual {
  const c = dados.consignado;
  const maior = c.maiorParcelaAberta;
  const parcial = c.parcelaParcial?.numero === maior ? c.parcelaParcial.valorCentavos : c.parcelaCentavos;
  const saldosMetas: Record<string, number> = {};
  for (const m of dados.metas) if (m.saldoCentavos !== undefined) saldosMetas[m.id] = m.saldoCentavos;

  return {
    // A projeção começa no mês seguinte à data de referência.
    mesInicial: somarMeses(mesDe(dados.dataReferencia), 1),
    cartoes: mapearCartoes(dados),
    faturasInformadas: dados.faturasAbertas.map(f => ({ cartaoId: f.cartaoId, competencia: f.competencia, valorCentavos: f.saldoInformadoCentavos })),
    parcelas: dados.parcelasEmAndamento.map(p => ({ ...p })),
    consignadoCfg: {
      parcelaCentavos: c.parcelaCentavos,
      k: c.formulaAntecipacao.k,
      base: c.formulaAntecipacao.base,
      mesBase: c.formulaAntecipacao.mesBase,
    },
    consignado: { menorAberta: c.parcelasPagasEmFolhaAte + 1, maiorAberta: maior, nominalMaiorCentavos: parcial },
    saldosMetas,
    // Saídas já certas do calendário (com valor) que não estão nas faturas informadas.
    eventosConhecidos: dados.eventos
      .filter(e => e.valorCentavos !== undefined)
      .map(e => ({ data: e.data, descricao: e.titulo, valorCentavos: e.valorCentavos!, tipo: 'saida' as const })),
  };
}
