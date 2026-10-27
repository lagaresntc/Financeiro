import { useState } from 'react';
import { db } from '../../db/db';
import { useDados } from '../dados';
import { Aviso, CampoTexto, Chips, Reais, Topo, toast } from '../componentes';
import { ir } from '../rotas';
import { lerFatura, type Banco } from '../../import/importar';
import type { LancamentoImportado } from '../../import/tipos';
import { marcarDuplicados } from '../../import/duplicados';
import { CATEGORIAS, aprenderRegra, categorizar, ehPixNoCredito, type Categoria, type RegraCategoria } from '../../domain/categorias';
import { formatarDiaMes, somarMeses } from '../../domain/datas';
import { cartaoCfg, faturaAbertaHoje } from '../../db/situacao';

interface Linha extends LancamentoImportado { incluir: boolean; duplicado: boolean; categoria: Categoria; sugerida: Categoria }

const BANCOS: { valor: Banco; rotulo: string; aceita: string }[] = [
  { valor: 'itau', rotulo: 'Itaú (PDF)', aceita: '.pdf,application/pdf' },
  { valor: 'nubank', rotulo: 'Nubank (CSV)', aceita: '.csv,text/csv' },
  { valor: 'generico', rotulo: 'Outro banco (PDF/CSV)', aceita: '.pdf,.csv,application/pdf,text/csv' },
];

export default function Importar() {
  const d = useDados();
  const [banco, setBanco] = useState<Banco>('nubank');
  const [cartaoId, setCartaoId] = useState(d.cartoes[0]?.id ?? '');
  const cartao = d.cartoes.find(c => c.id === cartaoId);
  const [competencia, setCompetencia] = useState(() => (cartao ? somarMeses(faturaAbertaHoje(cartaoCfg(cartao), d.hoje), -1) : ''));
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);

  async function ler(arquivo: File) {
    setErro(null);
    setLendo(true);
    try {
      const itens = await lerFatura(banco, arquivo);
      const existentes = d.lancamentos.filter(l => l.forma === cartaoId);
      const dup = marcarDuplicados(itens, existentes);
      setLinhas(itens.map((it, i) => {
        const sugerida = categorizar(it.descricao, d.regrasCategoria);
        return { ...it, incluir: !dup[i], duplicado: !!dup[i], categoria: sugerida, sugerida };
      }));
      if (itens.length === 0) setErro('Nenhum lançamento encontrado no arquivo. Confira o banco escolhido.');
    } catch (e) {
      setErro(`Não consegui ler o arquivo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLendo(false);
    }
  }

  async function salvar() {
    if (!linhas || !cartao) return;
    const escolhidas = linhas.filter(l => l.incluir);
    let regras: RegraCategoria[] = d.regrasCategoria;
    for (const l of escolhidas) if (l.categoria !== l.sugerida) regras = aprenderRegra(regras, l.descricao, l.categoria);
    const agora = new Date().toISOString();
    await db.transaction('rw', db.lancamentos, db.config, async () => {
      await db.lancamentos.bulkAdd(escolhidas.map(l => ({
        data: l.data, valorCentavos: l.valorCentavos, forma: cartao.id, categoria: l.categoria, descricao: l.descricao,
        parcelas: l.parcela?.n ?? 1, parcelaInicial: l.parcela?.k ?? 1, faturaRef: competencia || undefined,
        origem: 'importado' as const, criadoEm: agora,
      })));
      if (regras !== d.regrasCategoria) await db.config.put({ chave: 'regrasCategoria', valor: regras });
    });
    toast(`${escolhidas.length} lançamentos importados`);
    ir('cartoes', cartao.id, competencia);
  }

  const banco_ = BANCOS.find(b => b.valor === banco)!;
  const total = linhas?.filter(l => l.incluir).reduce((s, l) => s + l.valorCentavos, 0) ?? 0;

  if (d.cartoes.length === 0) {
    return <main className="tela"><Topo titulo="Importar fatura" comVoltar /><p className="vazio">Cadastre um cartão antes de importar.</p></main>;
  }

  return (
    <main className="tela">
      <Topo titulo="Importar fatura" comVoltar />
      {!linhas ? (
        <section className="cartao coluna">
          <span className="pequeno fraco">Banco</span>
          <Chips opcoes={BANCOS.map(b => ({ valor: b.valor, rotulo: b.rotulo }))} valor={banco} onChange={setBanco} />
          <span className="pequeno fraco">Cartão</span>
          <Chips opcoes={d.cartoes.map(c => ({ valor: c.id, rotulo: c.nome }))} valor={cartaoId} onChange={id => {
            setCartaoId(id);
            const c = d.cartoes.find(x => x.id === id);
            if (c) setCompetencia(somarMeses(faturaAbertaHoje(cartaoCfg(c), d.hoje), -1));
          }} />
          <CampoTexto rotulo="Fatura que vence em (mês)" tipo="month" valor={competencia} onChange={setCompetencia} />
          <label className="botao cheio">
            {lendo ? 'Lendo…' : 'Escolher arquivo'}
            <input type="file" accept={banco_.aceita} hidden disabled={lendo} onChange={e => { const f = e.target.files?.[0]; if (f) ler(f); e.target.value = ''; }} />
          </label>
          <p className="pequeno fraco">O arquivo é lido aqui no aparelho. Nada é enviado para fora.</p>
          {erro && <Aviso nivel="perigo" titulo={erro} />}
        </section>
      ) : (
        <>
          <Aviso nivel="info" titulo="Revise antes de salvar">
            Duplicados (já lançados) vêm desmarcados. Troque a categoria se precisar: o app aprende para a próxima.
          </Aviso>
          <section className="cartao">
            <div className="lista">
              {linhas.map((l, i) => {
                const mudar = (m: Partial<Linha>) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, ...m } : x)));
                return (
                  <div key={i} className="coluna" style={{ gap: 6, opacity: l.incluir ? 1 : 0.55 }}>
                    <label className="marcador">
                      <input type="checkbox" checked={l.incluir} onChange={e => mudar({ incluir: e.target.checked })} />
                      <span style={{ flex: 1 }}>
                        {l.descricao}
                        <span className="pequeno fraco"> · {formatarDiaMes(l.data)}{l.parcela ? ` · ${l.parcela.k}/${l.parcela.n}` : ''}{l.internacional ? ' · internacional' : ''}</span>
                      </span>
                      <strong className={l.valorCentavos < 0 ? 'verde' : ''}><Reais v={l.valorCentavos} /></strong>
                    </label>
                    <div className="linha">
                      <select className="entrada" style={{ minHeight: 40 }} value={l.categoria} onChange={e => mudar({ categoria: e.target.value as Categoria })}>
                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {l.duplicado && <span className="pequeno amarelo">Parece já lançado</span>}
                    {ehPixNoCredito(l.descricao) && <span className="pequeno vermelho">Pix no crédito: cobra IOF e encargos</span>}
                  </div>
                );
              })}
            </div>
          </section>
          <div className="linha">
            <button className="botao secundario" onClick={() => setLinhas(null)}>Voltar</button>
            <button className="botao" style={{ flex: 1 }} onClick={salvar} disabled={!linhas.some(l => l.incluir)}>
              Salvar {linhas.filter(l => l.incluir).length} (<Reais v={total} />)
            </button>
          </div>
        </>
      )}
    </main>
  );
}
