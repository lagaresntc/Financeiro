import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type {
  AntecipacaoDb, CartaoDb, CenarioDb, ConsignadoDb, EventoDb, FaturaDb, FechamentoMesDb, LancamentoDb, MetaDb,
  InvestimentoDb, VeiculoDb,
} from '../db/schema';
import { carregarSituacao, faturaAbertaHoje, gastosDoCiclo, itensDaFatura, cartaoCfg } from '../db/situacao';
import type { ParametrosPlano, SituacaoAtual } from '../domain/tipos';
import { hojeLocal } from '../domain/datas';
import { projetar, type Projecao } from '../domain/projecao';
import { calcularPodeGastar, cicloDoDia, type Ciclo, type PodeGastar } from '../domain/ciclo';
import { gerarAlertas, type Alerta } from '../domain/alertas';
import { REGRAS_PADRAO, type RegraCategoria } from '../domain/categorias';

export interface Dados {
  hoje: string;
  cartoes: CartaoDb[];
  lancamentos: LancamentoDb[];
  faturas: FaturaDb[];
  metas: MetaDb[];
  eventos: EventoDb[];
  cenarios: CenarioDb[];
  cenario: CenarioDb;
  parametros: ParametrosPlano;
  consignado: ConsignadoDb | undefined;
  antecipacoes: AntecipacaoDb[];
  fechamentos: FechamentoMesDb[];
  investimentos: InvestimentoDb[];
  veiculos: VeiculoDb[];
  regrasCategoria: RegraCategoria[];
  situacao: SituacaoAtual;
  projecao: Projecao;
  ciclo: Ciclo;
  podeGastar: PodeGastar;
  alertas: Alerta[];
}

const Contexto = createContext<Dados | null>(null);

export const HORIZONTE_MESES = 60;

/** Lê o banco (ao vivo) e calcula projeção, "pode gastar" e alertas uma vez para todas as telas. */
export function ProvedorDados({ children, carregando }: { children: ReactNode; carregando: ReactNode }) {
  const hoje = hojeLocal();
  const brutos = useLiveQuery(async () => {
    const [cartoes, lancamentos, faturas, metas, eventos, cenarios, consignados, antecipacoes, fechamentos, investimentos, veiculos, regras] =
      await Promise.all([
        db.cartoes.toArray(), db.lancamentos.toArray(), db.faturas.toArray(), db.metas.orderBy('ordem').toArray(),
        db.eventos.orderBy('data').toArray(), db.cenarios.toArray(), db.consignado.toArray(), db.antecipacoes.toArray(),
        db.fechamentoMes.toArray(), db.investimentos.toArray(), db.veiculos.toArray(), db.config.get('regrasCategoria'),
      ]);
    const situacao = await carregarSituacao(db, hoje);
    return {
      cartoes, lancamentos, faturas, metas, eventos, cenarios, consignado: consignados[0], antecipacoes, fechamentos,
      investimentos, veiculos, regrasCategoria: (regras?.valor as RegraCategoria[] | undefined) ?? REGRAS_PADRAO, situacao,
    };
  }, [hoje]);

  const dados = useMemo<Dados | null>(() => {
    if (!brutos) return null;
    const cenario = brutos.cenarios.find(c => c.ativo) ?? brutos.cenarios[0];
    if (!cenario) return null;
    const parametros = cenario.parametros;
    const projecao = projetar(brutos.situacao, parametros, { horizonteMeses: HORIZONTE_MESES });
    const ciclo = cicloDoDia(hoje);
    const gastos = gastosDoCiclo(brutos.lancamentos, ciclo);
    const podeGastar = calcularPodeGastar(projecao, ciclo, hoje, gastos.total, parametros.premissas.margemMinimaCentavos);
    const gastoFaturaAberta: Record<string, number> = {};
    for (const c of brutos.cartoes) {
      const cfg = cartaoCfg(c);
      gastoFaturaAberta[c.id] = itensDaFatura(cfg, faturaAbertaHoje(cfg, hoje), brutos.lancamentos).reduce((s, i) => s + i.valorCentavos, 0);
    }
    const alertas = gerarAlertas({
      hoje,
      cartoes: brutos.cartoes.map(cartaoCfg),
      parametros,
      podeGastarCentavos: podeGastar.valorCentavos,
      gastoFaturaAbertaPorCartao: gastoFaturaAberta,
      saldosMetas: brutos.situacao.saldosMetas,
      gastoPorCategoria: gastos.porCategoria,
      nomesMetas: Object.fromEntries(brutos.metas.map(m => [m.id, m.nome])),
      eventos: [...brutos.eventos, ...parametros.eventos.filter(e => e.tipo === 'saida').map(e => ({ data: e.data, titulo: e.descricao, valorCentavos: e.valorCentavos }))],
    });
    return { hoje, ...brutos, cenario, parametros, projecao, ciclo, podeGastar, alertas };
  }, [brutos, hoje]);

  if (!dados) return <>{carregando}</>;
  return <Contexto.Provider value={dados}>{children}</Contexto.Provider>;
}

export function useDados(): Dados {
  const d = useContext(Contexto);
  if (!d) throw new Error('useDados fora do ProvedorDados');
  return d;
}

/** Nome amigável de uma forma de pagamento. */
export function nomeForma(forma: string, cartoes: CartaoDb[]): string {
  if (forma === 'pix') return 'Pix';
  if (forma === 'dinheiro') return 'Dinheiro';
  return cartoes.find(c => c.id === forma)?.nome ?? forma;
}

/** Nome amigável de uma meta. */
export function nomeMeta(id: string, metas: { id: string; nome: string }[]): string {
  if (id === 'consignado') return metas.find(m => m.id === id)?.nome ?? 'Consignado';
  if (id === 'investimentos') return 'Investimentos';
  return metas.find(m => m.id === id)?.nome ?? id;
}
