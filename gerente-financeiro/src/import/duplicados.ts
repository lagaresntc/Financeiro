import { normalizar } from '../domain/categorias';
import type { Centavos, Data } from '../domain/tipos';
import type { LancamentoImportado } from './tipos';

interface Existente { data: Data; valorCentavos: Centavos; descricao: string }

function tokens(s: string): Set<string> {
  return new Set(s.replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(Boolean));
}

/** Descrições parecidas: uma contém a outra ou Jaccard de palavras ≥ 0,5. */
export function descricoesParecidas(a: string, b: string): boolean {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return na === nb;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = tokens(na);
  const tb = tokens(nb);
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const uniao = ta.size + tb.size - inter;
  return uniao > 0 && inter / uniao >= 0.5;
}

/** Para cada importado, true se já existe lançamento igual (data, valor e descrição parecida). */
export function marcarDuplicados(importados: LancamentoImportado[], existentes: Existente[]): boolean[] {
  return importados.map((i) =>
    existentes.some(
      (e) => e.data === i.data && e.valorCentavos === i.valorCentavos && descricoesParecidas(e.descricao, i.descricao),
    ),
  );
}
