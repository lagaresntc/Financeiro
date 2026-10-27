import { useEffect, useState, type ReactNode } from 'react';
import type { Centavos } from '../domain/tipos';
import { formatarReais } from '../domain/dinheiro';
import { parseValorBR } from '../import/valores';
import { voltar } from './rotas';

export function Topo({ titulo, comVoltar = false, acao }: { titulo: string; comVoltar?: boolean; acao?: ReactNode }) {
  return (
    <header className="topo">
      {comVoltar && <button className="voltar" onClick={voltar} aria-label="Voltar">←</button>}
      <h1>{titulo}</h1>
      {acao}
    </header>
  );
}

export function Reais({ v, sinal = false }: { v: Centavos; sinal?: boolean }) {
  const texto = formatarReais(v);
  return <span className="num">{sinal && v > 0 ? `+${texto}` : texto}</span>;
}

/** Texto digitado → centavos. Aceita "1.234,56", "1234,56", "1234.56" e "1234". */
export function textoParaCentavos(texto: string): Centavos | null {
  const t = texto.trim();
  if (!t) return null;
  const v = /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : parseValorBR(t);
  return Number.isFinite(v) ? v : null;
}

export function centavosParaTexto(v: Centavos | undefined): string {
  if (v === undefined) return '';
  return (v / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Campo de dinheiro: guarda centavos, mostra e aceita o formato brasileiro. */
export function CampoValor({
  rotulo, valor, onChange, grande = false, autoFocus = false, placeholder = '0,00',
}: {
  rotulo?: string; valor: Centavos | undefined; onChange: (v: Centavos | undefined) => void;
  grande?: boolean; autoFocus?: boolean; placeholder?: string;
}) {
  const [texto, setTexto] = useState(centavosParaTexto(valor));
  useEffect(() => {
    // Atualiza só quando o valor externo muda para algo diferente do que está digitado.
    if (textoParaCentavos(texto) !== (valor ?? null)) setTexto(centavosParaTexto(valor));
  }, [valor]);
  const input = (
    <input
      className={`entrada num ${grande ? 'entrada-valor' : ''}`}
      inputMode="decimal"
      autoFocus={autoFocus}
      placeholder={placeholder}
      value={texto}
      onChange={e => {
        setTexto(e.target.value);
        onChange(textoParaCentavos(e.target.value) ?? undefined);
      }}
      onBlur={() => setTexto(centavosParaTexto(textoParaCentavos(texto) ?? undefined))}
    />
  );
  if (!rotulo) return input;
  return <label className="campo"><span>{rotulo}</span>{input}</label>;
}

export function CampoTexto({ rotulo, valor, onChange, placeholder, tipo = 'text' }: {
  rotulo: string; valor: string; onChange: (v: string) => void; placeholder?: string; tipo?: string;
}) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <input className="entrada" type={tipo} value={valor} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

export function CampoNumero({ rotulo, valor, onChange, min, max, passo = 1, sufixo }: {
  rotulo: string; valor: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; passo?: number; sufixo?: string;
}) {
  return (
    <label className="campo">
      <span>{rotulo}{sufixo ? ` (${sufixo})` : ''}</span>
      <input
        className="entrada num" type="number" inputMode="decimal" min={min} max={max} step={passo}
        value={valor ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </label>
  );
}

export function Chips<T extends string>({ opcoes, valor, onChange }: {
  opcoes: { valor: T; rotulo: string }[]; valor: T | undefined; onChange: (v: T) => void;
}) {
  return (
    <div className="chips">
      {opcoes.map(o => (
        <button key={o.valor} type="button" className={`chip ${o.valor === valor ? 'ativo' : ''}`} onClick={() => onChange(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export function Passo({ valor, onChange, min = 1, max = 48, sufixo = '' }: {
  valor: number; onChange: (v: number) => void; min?: number; max?: number; sufixo?: string;
}) {
  return (
    <div className="passo">
      <button type="button" onClick={() => onChange(Math.max(min, valor - 1))} aria-label="Menos">−</button>
      <span className="valor-passo num">{valor}{sufixo}</span>
      <button type="button" onClick={() => onChange(Math.min(max, valor + 1))} aria-label="Mais">+</button>
    </div>
  );
}

export function Barra({ fracao }: { fracao: number }) {
  return <div className="barra"><div style={{ width: `${Math.round(Math.min(1, Math.max(0, fracao)) * 100)}%` }} /></div>;
}

export function Aviso({ nivel, titulo, children }: { nivel: 'info' | 'atencao' | 'perigo' | 'ok'; titulo?: string; children?: ReactNode }) {
  return (
    <div className={`aviso ${nivel}`} role={nivel === 'perigo' ? 'alert' : undefined}>
      {titulo && <strong>{titulo}</strong>}
      {children && <span>{children}</span>}
    </div>
  );
}

let mostrarToastGlobal: ((texto: string) => void) | null = null;

/** Mensagem curta no rodapé (ex.: "Entra na fatura Croma de 12/12"). */
export function toast(texto: string) {
  mostrarToastGlobal?.(texto);
}

export function Toast() {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    mostrarToastGlobal = (msg: string) => {
      setTexto(msg);
      clearTimeout(t);
      t = setTimeout(() => setTexto(null), 4000);
    };
    return () => { mostrarToastGlobal = null; clearTimeout(t); };
  }, []);
  if (!texto) return null;
  return <div className="toast" role="status" onClick={() => setTexto(null)}>{texto}</div>;
}

/** Baixa um objeto como arquivo .json. */
export function baixarJson(nome: string, conteudo: unknown) {
  const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
