import type { Dados } from './dados';
import type { Mes } from '../domain/tipos';
import { somarMeses } from '../domain/datas';
import { tetosDasFaturas, type TetoFatura } from '../domain/tetoFatura';
import { cartaoCfg, faturaAbertaHoje, totalDaFatura } from '../db/situacao';

/** Teto da fatura aberta (e da seguinte, se pedir) de cada cartão. Chave: `${cartaoId}|${competencia}`. */
export function calcularTetos(d: Dados, mesesAFrente = 0): Map<string, TetoFatura> {
  const total = (cartaoId: string, comp: Mes) => {
    const c = d.cartoes.find(x => x.id === cartaoId);
    if (!c) return 0;
    return totalDaFatura(cartaoCfg(c), comp, d.lancamentos, d.faturas.find(f => f.cartaoId === cartaoId && f.competencia === comp));
  };
  const faturas = d.cartoes.flatMap(c => {
    const aberta = faturaAbertaHoje(cartaoCfg(c), d.hoje);
    return Array.from({ length: mesesAFrente + 1 }, (_, i) => ({ cartaoId: c.id, competencia: somarMeses(aberta, i) }));
  });
  const lista = tetosDasFaturas(d.projecao, d.parametros, faturas, d.cartoes.map(c => c.id), total);
  return new Map(lista.map(t => [`${t.cartaoId}|${t.competencia}`, t]));
}

/** Sem renda no plano não dá para calcular teto. */
export function temRenda(d: Dados): boolean {
  return d.parametros.rendas.some(r => r.valorCentavos > 0);
}
