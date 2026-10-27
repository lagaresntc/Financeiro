import { useMemo, useState, type ReactNode } from 'react';
import { db } from '../../db/db';
import { useDados, nomeMeta } from '../dados';
import { Aviso, CampoNumero, CampoTexto, CampoValor, Reais, Topo, toast } from '../componentes';
import { ir, useRota } from '../rotas';
import { DatasPrevistas, TabelaProjecao, seriesDoPlano } from '../planoComum';
import type { ChaveExtra, Destino, EventoPlano, Fixa, MetaDoMes, ParametrosPlano, Renda } from '../../domain/tipos';
import { ID_CONSIGNADO, projetar } from '../../domain/projecao';
import { quantoGuardar } from '../../domain/quantoGuardar';
import { quitado } from '../../domain/consignado';
import { CATEGORIAS } from '../../domain/categorias';
import { formatarMes, somarMeses } from '../../domain/datas';
import { formatarReais } from '../../domain/dinheiro';

const NOMES_EXTRAS: Record<ChaveExtra, string> = {
  abono: 'Abono', decimoTerceiro: '13º salário', licenca: 'Licença', vendas: 'Vendas e entradas pontuais', consignadoLiberado: 'Parcela do consignado liberada',
};

function Secao({ titulo, children, aberta = false }: { titulo: string; children: ReactNode; aberta?: boolean }) {
  return (
    <details className="cartao" open={aberta}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 32, display: 'flex', alignItems: 'center' }}>{titulo}</summary>
      <div className="coluna" style={{ marginTop: 12, gap: 12 }}>{children}</div>
    </details>
  );
}

function novoId(prefixo: string) {
  return `${prefixo}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function EditorPlano() {
  const d = useDados();
  const rota = useRota();
  const cenarioBase = d.cenarios.find(c => c.id === rota[2]) ?? d.cenario;
  const [p, setP] = useState<ParametrosPlano>(() => structuredClone(cenarioBase.parametros));
  const [novasMetas, setNovasMetas] = useState<{ id: string; nome: string }[]>([]);
  const temConsignado = !!d.consignado && !quitado(d.situacao.consignado);
  const metasComNovas = useMemo(
    () => [...d.metas, ...novasMetas.map(m => ({ ...m, saldoCentavos: 0, ordem: 99 }))],
    [d.metas, novasMetas],
  );

  // Recalcula a cada alteração.
  const projecao = useMemo(() => projetar(d.situacao, p, { horizonteMeses: 60 }), [d.situacao, p]);
  const original = useMemo(() => projetar(d.situacao, cenarioBase.parametros, { horizonteMeses: 60 }), [d.situacao, cenarioBase]);
  const series = seriesDoPlano(p, metasComNovas, temConsignado);
  const alterado = JSON.stringify(p) !== JSON.stringify(cenarioBase.parametros);
  const mudar = (m: Partial<ParametrosPlano>) => setP(atual => ({ ...atual, ...m }));

  async function salvar(comoNovo: boolean) {
    const id = comoNovo ? novoId('cenario') : cenarioBase.id;
    const nome = comoNovo ? prompt('Nome do novo cenário:', `${cenarioBase.nome} (cópia)`) : cenarioBase.nome;
    if (!nome) return;
    await db.transaction('rw', db.cenarios, db.metas, async () => {
      for (const m of novasMetas) if (p.destinos.some(x => x.metaId === m.id)) await db.metas.put({ id: m.id, nome: m.nome, saldoCentavos: 0, ordem: 99 });
      if (comoNovo) {
        await db.cenarios.add({ id, nome, ativo: false, criadoEm: new Date().toISOString(), parametros: p });
      } else {
        await db.cenarios.update(id, { parametros: p });
      }
    });
    toast(comoNovo ? 'Cenário criado. Ative em Cenários para usar.' : 'Plano salvo');
    ir('plano', comoNovo ? 'cenarios' : '');
  }

  return (
    <main className="tela">
      <Topo titulo="Editor do plano" comVoltar />
      <p className="fraco pequeno">Cenário: <strong>{cenarioBase.nome}</strong>{cenarioBase.ativo ? ' (ativo)' : ''}. Mude qualquer número e veja as datas na hora.</p>

      <section className="cartao coluna" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
        <DatasPrevistas projecao={projecao} series={series} antes={original.datas} />
        <div className="linha">
          <button className="botao secundario pequeno" disabled={!alterado} onClick={() => { setP(structuredClone(cenarioBase.parametros)); setNovasMetas([]); }}>Desfazer</button>
          <button className="botao secundario pequeno" onClick={() => salvar(true)}>Salvar como novo</button>
          <button className="botao pequeno" disabled={!alterado} onClick={() => salvar(false)}>Salvar</button>
        </div>
      </section>

      <Secao titulo="Quanto guardar" aberta>
        <CampoValor rotulo="Meta mensal padrão" valor={p.metaMensalCentavos} onChange={v => mudar({ metaMensalCentavos: v ?? 0 })} />
        <h3>Exceções por mês</h3>
        {Object.entries(p.metaPorMes).sort().map(([mes, regra]) => (
          <ExcecaoMes
            key={mes} mes={mes} regra={regra}
            onChange={(novoMes, novaRegra) => {
              const m = { ...p.metaPorMes };
              delete m[mes];
              m[novoMes] = novaRegra;
              mudar({ metaPorMes: m });
            }}
            onRemover={() => { const m = { ...p.metaPorMes }; delete m[mes]; mudar({ metaPorMes: m }); }}
          />
        ))}
        <button className="botao secundario pequeno" onClick={() => {
          let mes = d.situacao.mesInicial;
          while (p.metaPorMes[mes] !== undefined) mes = somarMeses(mes, 1);
          mudar({ metaPorMes: { ...p.metaPorMes, [mes]: p.metaMensalCentavos } });
        }}>+ Exceção</button>
      </Secao>

      <Secao titulo="Meta por data (quanto guardar para chegar lá)">
        <MetaPorData p={p} series={series.filter(s => s.id !== ID_CONSIGNADO).concat(temConsignado ? [{ id: ID_CONSIGNADO, nome: nomeMeta(ID_CONSIGNADO, d.metas) }] : [])} onUsar={v => mudar({ metaMensalCentavos: v })} />
      </Secao>

      <Secao titulo="Extras: quanto vai para o plano">
        {(Object.keys(NOMES_EXTRAS) as ChaveExtra[]).map(k => (
          <CampoNumero key={k} rotulo={NOMES_EXTRAS[k]} sufixo="%" min={0} max={100} valor={p.extras[k]?.pct ?? 0}
            onChange={v => mudar({ extras: { ...p.extras, [k]: { pct: Math.min(100, Math.max(0, v ?? 0)) } } })} />
        ))}
      </Secao>

      <Secao titulo="Prioridades e metas">
        <p className="pequeno fraco">O dinheiro guardado vai para a primeira meta até completar, depois para a próxima.</p>
        <Destinos p={p} metas={metasComNovas} temConsignadoCadastrado={!!d.consignado} onChange={destinos => mudar({ destinos })} />
        <button className="botao secundario pequeno" onClick={() => {
          const nome = prompt('Nome da nova meta (ex.: Carro, Viagem):');
          if (!nome) return;
          const id = novoId('meta');
          setNovasMetas(n => [...n, { id, nome }]);
          mudar({ destinos: [...p.destinos, { metaId: id, ordem: Math.max(0, ...p.destinos.map(x => x.ordem)) + 1, alvoCentavos: 0 }] });
        }}>+ Nova meta</button>
      </Secao>

      <Secao titulo={`Renda (${formatarReais(p.rendas.filter(r => r.regra.tipo === 'mensal').reduce((s, r) => s + r.valorCentavos, 0))}/mês fixo)`}>
        {p.rendas.map((r, i) => (
          <EditorRenda key={r.id} renda={r} onChange={nova => mudar({ rendas: p.rendas.map((x, j) => (j === i ? nova : x)) })} onRemover={() => mudar({ rendas: p.rendas.filter((_, j) => j !== i) })} />
        ))}
        <button className="botao secundario pequeno" onClick={() => mudar({ rendas: [...p.rendas, { id: novoId('renda'), nome: 'Salário', valorCentavos: 0, regra: { tipo: 'mensal' }, dia: '5du' }] })}>+ Renda</button>
      </Secao>

      <Secao titulo={`Contas fixas (${formatarReais(p.fixas.reduce((s, f) => s + f.valorCentavos, 0))}/mês)`}>
        {p.fixas.map((f, i) => (
          <EditorFixa key={f.id} fixa={f} formas={[...d.cartoes.map(c => ({ id: c.id, nome: c.nome })), { id: 'pix', nome: 'Pix' }, { id: 'dinheiro', nome: 'Dinheiro' }]}
            onChange={nova => mudar({ fixas: p.fixas.map((x, j) => (j === i ? nova : x)) })} onRemover={() => mudar({ fixas: p.fixas.filter((_, j) => j !== i) })} />
        ))}
        <button className="botao secundario pequeno" onClick={() => mudar({ fixas: [...p.fixas, { id: novoId('fixa'), nome: 'Nova conta', valorCentavos: 0, forma: 'pix' }] })}>+ Conta fixa</button>
      </Secao>

      <Secao titulo={`Orçamento variável (${formatarReais(Object.values(p.orcamentoVariavel).reduce((s, v) => s + v, 0))}/mês)`}>
        {CATEGORIAS.map(cat => (
          <CampoValor key={cat} rotulo={cat} valor={p.orcamentoVariavel[cat]} onChange={v => {
            const o = { ...p.orcamentoVariavel };
            if (v) o[cat] = v; else delete o[cat];
            mudar({ orcamentoVariavel: o });
          }} />
        ))}
      </Secao>

      <Secao titulo="Eventos pontuais (venda, IPVA, compra grande)">
        {p.eventos.map((e, i) => (
          <EditorEvento key={i} evento={e} onChange={novo => mudar({ eventos: p.eventos.map((x, j) => (j === i ? novo : x)) })} onRemover={() => mudar({ eventos: p.eventos.filter((_, j) => j !== i) })} />
        ))}
        <button className="botao secundario pequeno" onClick={() => mudar({ eventos: [...p.eventos, { data: `${somarMeses(d.situacao.mesInicial, 1)}-10`, descricao: 'Novo evento', valorCentavos: 0, tipo: 'saida' }] })}>+ Evento</button>
      </Secao>

      <Secao titulo="Premissas">
        <CampoNumero rotulo="CDI ao ano" sufixo="%" passo={0.05} valor={round2(p.premissas.cdiAnual * 100)} onChange={v => mudar({ premissas: { ...p.premissas, cdiAnual: (v ?? 0) / 100 } })} />
        <CampoNumero rotulo="Caixinha rende" sufixo="% do CDI" valor={round2(p.premissas.caixinhaPctCdi * 100)} onChange={v => mudar({ premissas: { ...p.premissas, caixinhaPctCdi: (v ?? 0) / 100 } })} />
        <CampoValor rotulo="Limite da Caixinha" valor={p.premissas.caixinhaLimiteCentavos} onChange={v => mudar({ premissas: { ...p.premissas, caixinhaLimiteCentavos: v ?? 0 } })} />
        <CampoNumero rotulo="LCI/LCA rende" sufixo="% do CDI" valor={round2(p.premissas.lciPctCdi * 100)} onChange={v => mudar({ premissas: { ...p.premissas, lciPctCdi: (v ?? 0) / 100 } })} />
        <CampoValor rotulo="Margem mínima na conta" valor={p.premissas.margemMinimaCentavos} onChange={v => mudar({ premissas: { ...p.premissas, margemMinimaCentavos: v ?? 0 } })} />
      </Secao>

      <section className="cartao coluna">
        <h2>Projeção com estas mudanças</h2>
        <TabelaProjecao projecao={projecao} metas={metasComNovas} ate={Object.values(projecao.datas).sort().pop()} />
      </section>
    </main>
  );
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function ExcecaoMes({ mes, regra, onChange, onRemover }: { mes: string; regra: MetaDoMes; onChange: (mes: string, r: MetaDoMes) => void; onRemover: () => void }) {
  const tipo = typeof regra === 'number' ? 'valor' : regra;
  return (
    <div className="cartao coluna" style={{ background: 'var(--superficie-2)', gap: 8 }}>
      <div className="grade-2">
        <CampoTexto rotulo="Mês" tipo="month" valor={mes} onChange={v => v && onChange(v, regra)} />
        <label className="campo"><span>Guardar</span>
          <select className="entrada" value={tipo} onChange={e => onChange(mes, e.target.value === 'valor' ? 0 : (e.target.value as MetaDoMes))}>
            <option value="valor">Um valor</option>
            <option value="13o">Só os extras (ex.: 13º)</option>
            <option value="sobra">Tudo o que sobrar</option>
          </select>
        </label>
      </div>
      {typeof regra === 'number' && <CampoValor valor={regra} onChange={v => onChange(mes, v ?? 0)} />}
      <button className="link vermelho pequeno" style={{ alignSelf: 'flex-start' }} onClick={onRemover}>Remover exceção</button>
    </div>
  );
}

function Destinos({ p, metas, temConsignadoCadastrado, onChange }: {
  p: ParametrosPlano; metas: { id: string; nome: string }[]; temConsignadoCadastrado: boolean; onChange: (d: Destino[]) => void;
}) {
  const ordenados = [...p.destinos].sort((a, b) => a.ordem - b.ordem);
  const renumerar = (lista: Destino[]) => onChange(lista.map((x, i) => ({ ...x, ordem: i + 1 })));
  const mover = (i: number, delta: number) => {
    const lista = [...ordenados];
    const [item] = lista.splice(i, 1);
    lista.splice(i + delta, 0, item!);
    renumerar(lista);
  };
  return (
    <div className="lista">
      {ordenados.map((dst, i) => (
        <div key={dst.metaId} className="coluna" style={{ gap: 8 }}>
          <div className="linha">
            <strong>{i + 1}. {nomeMeta(dst.metaId, metas)}</strong>
            <span className="chips">
              <button className="chip" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">↑</button>
              <button className="chip" disabled={i === ordenados.length - 1} onClick={() => mover(i, 1)} aria-label="Descer">↓</button>
              <button className="chip" onClick={() => renumerar(ordenados.filter((_, j) => j !== i))} aria-label="Remover">✕</button>
            </span>
          </div>
          {dst.metaId === ID_CONSIGNADO ? (
            <span className="pequeno fraco">Até quitar (antecipando as últimas parcelas).</span>
          ) : (
            <CampoValor rotulo="Alvo (vazio = sem limite)" valor={dst.alvoCentavos} onChange={v => renumerar(ordenados.map((x, j) => (j === i ? { ...x, alvoCentavos: v } : x)))} />
          )}
        </div>
      ))}
      {temConsignadoCadastrado && !p.destinos.some(x => x.metaId === ID_CONSIGNADO) && (
        <button className="link" onClick={() => renumerar([...ordenados, { metaId: ID_CONSIGNADO, ordem: 0 }])}>+ Incluir o consignado</button>
      )}
    </div>
  );
}

function MetaPorData({ p, series, onUsar }: { p: ParametrosPlano; series: { id: string; nome: string }[]; onUsar: (v: number) => void }) {
  const d = useDados();
  const [metaId, setMetaId] = useState(series.find(s => s.id !== ID_CONSIGNADO)?.id ?? series[0]?.id ?? '');
  const [mes, setMes] = useState(somarMeses(d.situacao.mesInicial, 12));
  const r = useMemo(() => (metaId ? quantoGuardar(d.situacao, p, metaId, mes) : null), [d.situacao, p, metaId, mes]);
  if (series.length === 0) return <p className="vazio">Crie uma meta com alvo primeiro.</p>;
  return (
    <>
      <div className="grade-2">
        <label className="campo"><span>Meta</span>
          <select className="entrada" value={metaId} onChange={e => setMetaId(e.target.value)}>
            {series.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </label>
        <CampoTexto rotulo="Pronta em" tipo="month" valor={mes} onChange={v => v && setMes(v)} />
      </div>
      {r && (r.possivel ? (
        <Aviso nivel="ok" titulo={`Guarde ${formatarReais(r.metaMensalCentavos)} por mês`}>
          Fica pronta em {formatarMes(r.mesPronto)}. As exceções por mês continuam valendo.{' '}
          <button className="link" onClick={() => onUsar(r.metaMensalCentavos)}>Usar este valor</button>
        </Aviso>
      ) : (
        <Aviso nivel="perigo" titulo="Não dá até essa data">
          Mesmo guardando tudo o que a folga permite, {r.melhorMes ? `o mais cedo é ${formatarMes(r.melhorMes)}` : 'não fica pronta em 20 anos'}.
          {r.mesesTravados.length > 0 && ` Meses que travam: ${r.mesesTravados.slice(0, 6).map(formatarMes).join(', ')}${r.mesesTravados.length > 6 ? '…' : ''}.`}
          {r.faltaNaDataCentavos > 0 && ` Faltariam ${formatarReais(r.faltaNaDataCentavos)} na data.`}
        </Aviso>
      ))}
    </>
  );
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function EditorRenda({ renda, onChange, onRemover }: { renda: Renda; onChange: (r: Renda) => void; onRemover: () => void }) {
  const r = renda;
  return (
    <div className="cartao coluna" style={{ background: 'var(--superficie-2)', gap: 8 }}>
      <div className="grade-2">
        <CampoTexto rotulo="Nome" valor={r.nome} onChange={nome => onChange({ ...r, nome })} />
        <CampoValor rotulo="Valor" valor={r.valorCentavos} onChange={v => onChange({ ...r, valorCentavos: v ?? 0 })} />
      </div>
      <div className="grade-2">
        <label className="campo"><span>Quando</span>
          <select className="entrada" value={r.regra.tipo} onChange={e => {
            const t = e.target.value as Renda['regra']['tipo'];
            const regra: Renda['regra'] = t === 'mensal' ? { tipo: 'mensal' } : t === 'meses' ? { tipo: 'meses', meses: [] } : t === 'datas' ? { tipo: 'datas', datas: [] } : { tipo: 'unica', mes: '' };
            onChange({ ...r, regra });
          }}>
            <option value="mensal">Todo mês</option>
            <option value="meses">Em certos meses do ano</option>
            <option value="datas">Em datas específicas</option>
            <option value="unica">Uma vez (substitui outras)</option>
          </select>
        </label>
        <label className="campo"><span>Dia</span>
          <select className="entrada" value={String(r.dia ?? '5du')} onChange={e => onChange({ ...r, dia: e.target.value === '5du' ? '5du' : Number(e.target.value) })}>
            <option value="5du">5º dia útil</option>
            {Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>Dia {i + 1}</option>)}
          </select>
        </label>
      </div>
      {r.regra.tipo === 'meses' && (
        <div className="chips">
          {MESES.map((nome, i) => {
            const regra = r.regra as { tipo: 'meses'; meses: number[] };
            const ativo = regra.meses.includes(i + 1);
            return <button key={nome} className={`chip ${ativo ? 'ativo' : ''}`} onClick={() => onChange({ ...r, regra: { tipo: 'meses', meses: ativo ? regra.meses.filter(m => m !== i + 1) : [...regra.meses, i + 1].sort((a, b) => a - b) } })}>{nome}</button>;
          })}
        </div>
      )}
      {r.regra.tipo === 'datas' && (
        <CampoTexto rotulo="Datas (separe por vírgula, dd/mm/aaaa)" valor={r.regra.datas.map(x => x.split('-').reverse().join('/')).join(', ')}
          onChange={v => onChange({ ...r, regra: { tipo: 'datas', datas: v.split(',').map(s => s.trim()).filter(s => /^\d{2}\/\d{2}\/\d{4}$/.test(s)).map(s => s.split('/').reverse().join('-')) } })} />
      )}
      {r.regra.tipo === 'unica' && (
        <CampoTexto rotulo="Mês" tipo="month" valor={r.regra.mes} onChange={mes => onChange({ ...r, regra: { ...(r.regra as { tipo: 'unica'; mes: string; substitui?: string[] }), mes } })} />
      )}
      {r.regra.tipo !== 'unica' && (
        <div className="grade-2">
          <CampoTexto rotulo="A partir de (opcional)" tipo="month" valor={r.inicio ?? ''} onChange={v => onChange({ ...r, inicio: v || undefined })} />
          <CampoTexto rotulo="Até (opcional)" tipo="month" valor={r.fim ?? ''} onChange={v => onChange({ ...r, fim: v || undefined })} />
        </div>
      )}
      <label className="campo"><span>É um extra?</span>
        <select className="entrada" value={r.extra ?? ''} onChange={e => onChange({ ...r, extra: (e.target.value || undefined) as ChaveExtra | undefined })}>
          <option value="">Não (renda normal)</option>
          <option value="abono">Abono</option>
          <option value="decimoTerceiro">13º</option>
          <option value="licenca">Licença</option>
        </select>
      </label>
      <button className="link vermelho pequeno" style={{ alignSelf: 'flex-start' }} onClick={onRemover}>Remover renda</button>
    </div>
  );
}

function EditorFixa({ fixa, formas, onChange, onRemover }: { fixa: Fixa; formas: { id: string; nome: string }[]; onChange: (f: Fixa) => void; onRemover: () => void }) {
  return (
    <div className="cartao coluna" style={{ background: 'var(--superficie-2)', gap: 8 }}>
      <div className="grade-2">
        <CampoTexto rotulo="Nome" valor={fixa.nome} onChange={nome => onChange({ ...fixa, nome })} />
        <CampoValor rotulo="Valor" valor={fixa.valorCentavos} onChange={v => onChange({ ...fixa, valorCentavos: v ?? 0 })} />
      </div>
      <label className="campo"><span>Paga com</span>
        <select className="entrada" value={fixa.forma} onChange={e => onChange({ ...fixa, forma: e.target.value })}>
          {formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </label>
      <div className="grade-2">
        <CampoTexto rotulo="A partir de (opcional)" tipo="month" valor={fixa.inicio ?? ''} onChange={v => onChange({ ...fixa, inicio: v || undefined })} />
        <CampoTexto rotulo="Até (opcional)" tipo="month" valor={fixa.fim ?? ''} onChange={v => onChange({ ...fixa, fim: v || undefined })} />
      </div>
      <button className="link vermelho pequeno" style={{ alignSelf: 'flex-start' }} onClick={onRemover}>Remover conta</button>
    </div>
  );
}

function EditorEvento({ evento, onChange, onRemover }: { evento: EventoPlano; onChange: (e: EventoPlano) => void; onRemover: () => void }) {
  return (
    <div className="cartao coluna" style={{ background: 'var(--superficie-2)', gap: 8 }}>
      <CampoTexto rotulo="Descrição" valor={evento.descricao} onChange={descricao => onChange({ ...evento, descricao })} />
      <div className="grade-2">
        <CampoTexto rotulo="Data" tipo="date" valor={evento.data} onChange={data => data && onChange({ ...evento, data })} />
        <CampoValor rotulo="Valor" valor={evento.valorCentavos} onChange={v => onChange({ ...evento, valorCentavos: v ?? 0 })} />
      </div>
      <div className="chips">
        <button className={`chip ${evento.tipo === 'entrada' ? 'ativo' : ''}`} onClick={() => onChange({ ...evento, tipo: 'entrada' })}>Entrada</button>
        <button className={`chip ${evento.tipo === 'saida' ? 'ativo' : ''}`} onClick={() => onChange({ ...evento, tipo: 'saida' })}>Saída</button>
      </div>
      <span className="pequeno fraco">{evento.tipo === 'entrada' ? <>Entra no mês e vai para o plano conforme "Vendas" em Extras.</> : <>Sai do mês: <Reais v={evento.valorCentavos} />.</>}</span>
      <button className="link vermelho pequeno" style={{ alignSelf: 'flex-start' }} onClick={onRemover}>Remover evento</button>
    </div>
  );
}
