import type { Centavos, Mes, ParametrosPlano } from './tipos';
import type { Projecao } from './projecao';

export interface TetoFatura {
  cartaoId: string;
  competencia: Mes;
  /** Quanto já está na fatura (lançamentos, parcelas e saldo informado). */
  atualCentavos: Centavos;
  /** Até quanto esta fatura pode chegar sem tirar dinheiro da meta nem da margem mínima. */
  tetoCentavos: Centavos;
  restaCentavos: Centavos;
}

/**
 * Quanto o mês comporta em faturas de cartão: renda − contas pagas fora do cartão − saídas pontuais
 * − meta planejada − margem mínima. Em mês de "guardar tudo o que sobrar", a meta não reserva nada.
 */
export function orcamentoParaCartoes(projecao: Projecao, p: ParametrosPlano, mes: Mes, cartoesIds: Set<string>): Centavos | null {
  const linha = projecao.meses.find(m => m.mes === mes);
  if (!linha) return null;
  const fixasForaDoCartao = p.fixas
    .filter(f => !cartoesIds.has(f.forma))
    .filter(f => (!f.inicio || mes >= f.inicio) && (!f.fim || mes <= f.fim))
    .reduce((s, f) => s + f.valorCentavos, 0);
  const meta = p.metaPorMes[mes] === 'sobra' ? 0 : linha.metaPlanejadaCentavos;
  return linha.rendaCentavos - fixasForaDoCartao - linha.eventosSaidaCentavos - meta - p.premissas.margemMinimaCentavos;
}

/**
 * Teto de cada fatura no mês em que ela vence. Os outros cartões entram com o que já têm
 * naquela competência: o teto diz até onde este cartão pode ir se os outros ficarem como estão.
 */
export function tetosDasFaturas(
  projecao: Projecao,
  p: ParametrosPlano,
  faturas: { cartaoId: string; competencia: Mes }[],
  cartoesIds: string[],
  totalFatura: (cartaoId: string, competencia: Mes) => Centavos,
): TetoFatura[] {
  const ids = new Set(cartoesIds);
  const resultado: TetoFatura[] = [];
  for (const f of faturas) {
    const orcamento = orcamentoParaCartoes(projecao, p, f.competencia, ids);
    if (orcamento === null) continue;
    const outros = cartoesIds.filter(id => id !== f.cartaoId).reduce((s, id) => s + totalFatura(id, f.competencia), 0);
    const atual = totalFatura(f.cartaoId, f.competencia);
    const teto = orcamento - outros;
    resultado.push({ cartaoId: f.cartaoId, competencia: f.competencia, atualCentavos: atual, tetoCentavos: teto, restaCentavos: teto - atual });
  }
  return resultado;
}
