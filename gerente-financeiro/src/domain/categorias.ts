export const CATEGORIAS = [
  'Mercado', 'Gasolina', 'Farmácia', 'Delivery/lanche', 'Compras online',
  'Bebê', 'Viagem', 'Casa', 'Veículos', 'Estudos', 'Outros',
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export interface RegraCategoria {
  /** fonte de regex, aplicada sem diferenciar maiúsculas e sobre o texto normalizado */
  padrao: string;
  categoria: Categoria;
}

export const REGRAS_PADRAO: RegraCategoria[] = [
  // antes de Mercado, senão MERCADOLIVRE cairia em Mercado
  { padrao: 'SHOPEE|MERCADO ?LIVRE|AMAZON|TIKTOK', categoria: 'Compras online' },
  { padrao: 'SUPERMERCADO|MERCADO|COMERCIAL|PADARIA', categoria: 'Mercado' },
  { padrao: 'AUTO POSTO|POSTO', categoria: 'Gasolina' },
  { padrao: 'FARMACIA|DROGARIA', categoria: 'Farmácia' },
  { padrao: 'IFD|IFOOD|BURGUER|SUSHI|LANCHE', categoria: 'Delivery/lanche' },
];

/** Maiúsculas, sem acentos, espaços colapsados. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function casa(padrao: string, texto: string): boolean {
  try {
    return new RegExp(normalizar(padrao), 'i').test(texto);
  } catch {
    return false; // regra inválida digitada pelo usuário: ignora
  }
}

/** Primeira regra que casar vence (as do usuário vêm antes). */
export function categorizar(descricao: string, regras: RegraCategoria[]): Categoria {
  const texto = normalizar(descricao);
  for (const r of regras) if (casa(r.padrao, texto)) return r.categoria;
  return 'Outros';
}

/** Alerta "Pix no crédito". */
export function ehPixNoCredito(descricao: string): boolean {
  return /(^|[^A-Z0-9])PIX([^A-Z0-9]|$)/.test(normalizar(descricao));
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Chave estável do estabelecimento: 2 primeiras palavras, sem parcela, dígitos ou pontuação. */
export function chaveEstabelecimento(descricao: string): string {
  const palavras = normalizar(descricao)
    .replace(/PARCELA\s*\d+\s*\/\s*\d+/g, ' ')
    .replace(/\d+\s*\/\s*\d+/g, ' ')
    .replace(/[^A-Z\s]/g, ' ')
    .split(' ')
    .filter((p) => p.length >= 2);
  return palavras.slice(0, 2).join(' ');
}

/** Guarda a correção do usuário como regra, na frente das demais. */
export function aprenderRegra(
  regras: RegraCategoria[],
  descricao: string,
  categoria: Categoria,
): RegraCategoria[] {
  const chave = chaveEstabelecimento(descricao);
  if (!chave) return regras;
  const padrao = escaparRegex(chave);
  return [{ padrao, categoria }, ...regras.filter((r) => r.padrao !== padrao)];
}
