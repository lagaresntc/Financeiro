import { useState } from 'react';
import { db } from '../../db/db';
import { useDados } from '../dados';
import { Aviso, CampoNumero, CampoTexto, CampoValor, Chips, Reais, Topo, baixarJson, toast } from '../componentes';
import { href, ir } from '../rotas';
import type { CartaoDb, ConsignadoDb, InvestimentoDb, VeiculoDb } from '../../db/schema';
import { apagarTudo, exportarBackup, importarArquivo } from '../../db/backup';
import { REGRAS_PADRAO } from '../../domain/categorias';
import { formatarDiaMes, somarMeses } from '../../domain/datas';

export default function Ajustes({ rota }: { rota: string[] }) {
  if (rota[0] === 'cartao') return <EditorCartao id={rota[1] ?? 'novo'} />;
  if (rota[0] === 'consignado') return <EditorConsignado />;
  return <Principal />;
}

function Principal() {
  const d = useDados();
  const regrasUsuario = d.regrasCategoria.slice(0, Math.max(0, d.regrasCategoria.length - REGRAS_PADRAO.length));
  return (
    <main className="tela">
      <Topo titulo="Ajustes" comVoltar />

      <section className="cartao coluna">
        <h2>Renda, contas fixas e orçamento</h2>
        <p className="pequeno fraco">Ficam no plano, porque cada cenário pode ter os seus.</p>
        <a className="botao secundario cheio" href={href('plano', 'editor')}>Abrir o editor do plano</a>
      </section>

      <section className="cartao coluna">
        <div className="linha"><h2>Cartões</h2><a className="botao pequeno secundario" href={href('ajustes', 'cartao', 'novo')}>+ Cartão</a></div>
        <div className="lista">
          {d.cartoes.map(c => (
            <a key={c.id} href={href('ajustes', 'cartao', c.id)} className="linha" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span>{c.nome}{c.principal ? ' ★' : ''}</span>
              <span className="pequeno fraco">fecha {c.diaFechamento} · vence {c.diaVencimento} ›</span>
            </a>
          ))}
          {d.cartoes.length === 0 && <p className="vazio">Nenhum cartão.</p>}
        </div>
      </section>

      <SaldosMetas />

      <section className="cartao coluna">
        <h2>Consignado</h2>
        {d.consignado ? (
          <a className="linha" href={href('ajustes', 'consignado')} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>{d.consignado.banco} · <Reais v={d.consignado.cfg.parcelaCentavos} />/mês</span><span className="fraco">Editar ›</span>
          </a>
        ) : (
          <a className="botao secundario cheio" href={href('ajustes', 'consignado')}>Cadastrar consignado</a>
        )}
      </section>

      <Lembretes />
      <Investimentos />
      <Veiculos />

      <section className="cartao coluna">
        <h2>Regras de categoria aprendidas</h2>
        {regrasUsuario.length === 0 ? <p className="pequeno fraco">Quando você troca a categoria sugerida, o app guarda a regra aqui.</p> : (
          <div className="lista">
            {regrasUsuario.map((r, i) => (
              <div key={`${r.padrao}${i}`} className="linha pequeno">
                <span><code>{r.padrao}</code> → {r.categoria}</span>
                <button className="link vermelho" onClick={() => db.config.put({ chave: 'regrasCategoria', valor: d.regrasCategoria.filter((_, j) => j !== i) })}>Remover</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Backup />
    </main>
  );
}

function SaldosMetas() {
  const d = useDados();
  const metas = d.metas.filter(m => m.id !== 'consignado');
  return (
    <section className="cartao coluna">
      <h2>Saldo atual das metas</h2>
      <p className="pequeno fraco">Ajuste para bater com o que está guardado de verdade. A projeção recomeça daqui.</p>
      {metas.map(m => (
        <CampoValor key={m.id} rotulo={m.nome} valor={m.saldoCentavos} onChange={v => db.metas.update(m.id, { saldoCentavos: v ?? 0 })} />
      ))}
      {metas.length === 0 && <p className="vazio">Sem metas. Crie no editor do plano.</p>}
    </section>
  );
}

function Lembretes() {
  const d = useDados();
  const [novo, setNovo] = useState<{ data: string; titulo: string; valor?: number }>({ data: d.hoje, titulo: '' });
  const futuros = d.eventos.filter(e => e.data >= d.hoje);
  return (
    <section className="cartao coluna">
      <h2>Lembretes e saídas certas</h2>
      <p className="pequeno fraco">Com valor, entram na projeção como saída do mês (ex.: Pix de uma hospedagem). Para cenários "e se", use eventos no editor do plano.</p>
      <div className="lista">
        {futuros.map(e => (
          <div key={e.id} className="linha pequeno">
            <span>{formatarDiaMes(e.data)} · {e.titulo}</span>
            <span>{e.valorCentavos !== undefined && <Reais v={e.valorCentavos} />} <button className="link vermelho" onClick={() => e.id !== undefined && db.eventos.delete(e.id)}>✕</button></span>
          </div>
        ))}
      </div>
      <div className="grade-2">
        <CampoTexto rotulo="Data" tipo="date" valor={novo.data} onChange={data => setNovo({ ...novo, data })} />
        <CampoValor rotulo="Valor (opcional)" valor={novo.valor} onChange={valor => setNovo({ ...novo, valor })} />
      </div>
      <CampoTexto rotulo="O quê" valor={novo.titulo} onChange={titulo => setNovo({ ...novo, titulo })} placeholder="Ex.: IPVA" />
      <button className="botao secundario pequeno" disabled={!novo.titulo.trim() || !novo.data} onClick={async () => {
        await db.eventos.add({ data: novo.data, titulo: novo.titulo.trim(), valorCentavos: novo.valor, tipo: novo.valor ? 'saida' : 'lembrete' });
        setNovo({ data: d.hoje, titulo: '' });
      }}>Adicionar</button>
    </section>
  );
}

function Investimentos() {
  const d = useDados();
  const total = d.investimentos.reduce((s, i) => s + (i.valorCentavos ?? (i.quantidade ?? 0) * (i.precoMedioCentavos ?? 0)), 0);
  const atualizar = (i: InvestimentoDb, m: Partial<InvestimentoDb>) => i.id !== undefined && db.investimentos.update(i.id, m);
  return (
    <section className="cartao coluna">
      <div className="linha"><h2>Investimentos</h2><span className="fraco pequeno"><Reais v={total} /></span></div>
      {d.investimentos.map(i => (
        <div key={i.id} className="coluna" style={{ gap: 6 }}>
          <div className="linha"><strong>{i.nome}</strong><button className="link vermelho pequeno" onClick={() => i.id !== undefined && confirm(`Remover ${i.nome}?`) && db.investimentos.delete(i.id)}>Remover</button></div>
          {i.quantidade !== undefined ? (
            <div className="grade-2">
              <CampoNumero rotulo="Quantidade" valor={i.quantidade} onChange={v => atualizar(i, { quantidade: v ?? 0 })} />
              <CampoValor rotulo="Preço médio" valor={i.precoMedioCentavos} onChange={v => atualizar(i, { precoMedioCentavos: v ?? 0 })} />
            </div>
          ) : (
            <div className="grade-2">
              <CampoValor rotulo="Valor" valor={i.valorCentavos} onChange={v => atualizar(i, { valorCentavos: v ?? 0 })} />
              <CampoValor rotulo="Livre para usar" valor={i.livreCentavos} onChange={v => atualizar(i, { livreCentavos: v })} />
            </div>
          )}
        </div>
      ))}
      <div className="linha">
        <button className="botao secundario pequeno" onClick={() => { const nome = prompt('Nome (ex.: CDB, Caixinha):'); if (nome) db.investimentos.add({ tipo: 'rendaFixa', nome, valorCentavos: 0 }); }}>+ Renda fixa</button>
        <button className="botao secundario pequeno" onClick={() => { const nome = prompt('Código da ação (ex.: ABCD3):'); if (nome) db.investimentos.add({ tipo: 'acao', nome: nome.toUpperCase(), quantidade: 0, precoMedioCentavos: 0 }); }}>+ Ação</button>
      </div>
    </section>
  );
}

function Veiculos() {
  const d = useDados();
  const atualizar = (v: VeiculoDb, m: Partial<VeiculoDb>) => db.veiculos.update(v.id, m);
  return (
    <section className="cartao coluna">
      <h2>Veículos</h2>
      {d.veiculos.map(v => (
        <div key={v.id} className="coluna" style={{ gap: 6 }}>
          <div className="linha"><strong>{v.nome} {v.ano}</strong><button className="link vermelho pequeno" onClick={() => confirm(`Remover ${v.nome}?`) && db.veiculos.delete(v.id)}>Remover</button></div>
          <Chips opcoes={[{ valor: 'manter', rotulo: 'Manter' }, { valor: 'vender', rotulo: 'Vender' }]} valor={v.plano} onChange={plano => atualizar(v, { plano })} />
          <CampoValor rotulo="FIPE" valor={v.fipeCentavos} onChange={f => atualizar(v, { fipeCentavos: f })} />
          <CampoTexto rotulo="Notas" valor={v.notas ?? ''} onChange={notas => atualizar(v, { notas })} />
          {v.plano === 'vender' && <span className="pequeno fraco">Para contar a venda no plano, crie um evento de entrada no editor do plano.</span>}
        </div>
      ))}
      <button className="botao secundario pequeno" onClick={() => {
        const nome = prompt('Veículo (ex.: Carro):');
        if (nome) db.veiculos.add({ id: `veiculo-${Math.random().toString(36).slice(2, 8)}`, nome, ano: new Date().getFullYear(), plano: 'manter' });
      }}>+ Veículo</button>
    </section>
  );
}

function Backup() {
  const d = useDados();
  async function importar(arquivo: File) {
    if (!confirm('Importar substitui TODOS os dados deste aparelho pelos do arquivo. Continuar?')) return;
    try {
      const tipo = await importarArquivo(db, JSON.parse(await arquivo.text()));
      alert(tipo === 'backup' ? 'Backup restaurado.' : 'Dados iniciais carregados.');
      location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <section className="cartao coluna">
      <h2>Backup</h2>
      <p className="pequeno fraco">Os dados ficam só neste aparelho. Exporte um backup de vez em quando e guarde em local seguro.</p>
      <button className="botao cheio" onClick={async () => { baixarJson(`financas-backup-${d.hoje}.json`, await exportarBackup(db)); toast('Backup exportado'); }}>Exportar backup (.json)</button>
      <label className="botao secundario cheio">
        Importar backup
        <input type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
      </label>
      <button className="botao perigo cheio" onClick={async () => {
        if (!confirm('Apagar TODOS os dados deste aparelho?')) return;
        if (!confirm('Tem certeza? Não dá para desfazer sem um backup.')) return;
        await apagarTudo(db);
        location.hash = '';
        location.reload();
      }}>Apagar tudo</button>
    </section>
  );
}

function EditorCartao({ id }: { id: string }) {
  const d = useDados();
  const existente = d.cartoes.find(c => c.id === id);
  const [c, setC] = useState<CartaoDb>(existente ?? { id: '', nome: '', diaFechamento: 1, diaVencimento: 10, principal: d.cartoes.length === 0 });
  const [mudaVenc, setMudaVenc] = useState(existente?.vencimentos?.[0]);
  const [isencao, setIsencao] = useState(existente?.isencao);
  const valido = c.nome.trim() && c.diaFechamento >= 1 && c.diaFechamento <= 31 && c.diaVencimento >= 1 && c.diaVencimento <= 31;

  async function salvar() {
    const novoId = existente?.id ?? (c.nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cartao');
    const final: CartaoDb = { ...c, id: novoId, nome: c.nome.trim(), vencimentos: mudaVenc ? [mudaVenc] : undefined, isencao };
    await db.transaction('rw', db.cartoes, async () => {
      if (final.principal) for (const x of d.cartoes) if (x.id !== novoId && x.principal) await db.cartoes.update(x.id, { principal: false });
      await db.cartoes.put(final);
    });
    toast('Cartão salvo');
    ir('cartoes');
  }

  return (
    <main className="tela">
      <Topo titulo={existente ? existente.nome : 'Novo cartão'} comVoltar />
      <section className="cartao coluna">
        <CampoTexto rotulo="Nome" valor={c.nome} onChange={nome => setC({ ...c, nome })} placeholder="Ex.: Nubank" />
        <div className="grade-2">
          <CampoNumero rotulo="Dia do fechamento" min={1} max={31} valor={c.diaFechamento} onChange={v => setC({ ...c, diaFechamento: v ?? 1 })} />
          <CampoNumero rotulo="Dia do vencimento" min={1} max={31} valor={c.diaVencimento} onChange={v => setC({ ...c, diaVencimento: v ?? 1 })} />
        </div>
        <CampoValor rotulo="Limite (opcional)" valor={c.limiteCentavos} onChange={v => setC({ ...c, limiteCentavos: v })} />
        <CampoNumero rotulo="Cashback" sufixo="%" passo={0.1} valor={c.cashbackPct} onChange={v => setC({ ...c, cashbackPct: v })} />
        <label className="marcador"><input type="checkbox" checked={c.principal} onChange={e => setC({ ...c, principal: e.target.checked })} /> Cartão principal (vem marcado ao lançar)</label>
      </section>

      <section className="cartao coluna">
        <h3>Mudança de vencimento</h3>
        {mudaVenc ? (
          <div className="grade-2">
            <CampoTexto rotulo="A partir da fatura de" tipo="month" valor={mudaVenc.aPartirDe} onChange={aPartirDe => setMudaVenc({ ...mudaVenc, aPartirDe })} />
            <CampoNumero rotulo="Novo dia" min={1} max={31} valor={mudaVenc.dia} onChange={dia => setMudaVenc({ ...mudaVenc, dia: dia ?? 1 })} />
          </div>
        ) : <button className="link" onClick={() => setMudaVenc({ aPartirDe: d.hoje.slice(0, 7), dia: c.diaVencimento })}>+ Vai mudar o vencimento</button>}
        {mudaVenc && <button className="link vermelho pequeno" style={{ alignSelf: 'flex-start' }} onClick={() => setMudaVenc(undefined)}>Remover mudança</button>}
      </section>

      <section className="cartao coluna">
        <h3>Mensalidade / anuidade</h3>
        {isencao ? (
          <>
            <CampoValor rotulo="Valor da mensalidade" valor={isencao.mensalidadeCentavos} onChange={v => setIsencao({ ...isencao, mensalidadeCentavos: v ?? 0 })} />
            <CampoValor rotulo="Isenta com gasto na fatura de pelo menos" valor={isencao.gastoMinCentavos} onChange={v => setIsencao({ ...isencao, gastoMinCentavos: v })} />
            <CampoValor rotulo="…ou com saldo guardado de pelo menos" valor={isencao.saldoMinCentavos} onChange={v => setIsencao({ ...isencao, saldoMinCentavos: v })} />
            <label className="campo"><span>Saldo de qual meta conta?</span>
              <select className="entrada" value={isencao.metaIdSaldo ?? ''} onChange={e => setIsencao({ ...isencao, metaIdSaldo: e.target.value || undefined })}>
                <option value="">Nenhuma</option>
                {d.metas.filter(m => m.id !== 'consignado').map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </label>
            <button className="link vermelho pequeno" style={{ alignSelf: 'flex-start' }} onClick={() => setIsencao(undefined)}>Sem mensalidade</button>
          </>
        ) : <button className="link" onClick={() => setIsencao({ mensalidadeCentavos: 0 })}>+ Tem mensalidade com isenção</button>}
      </section>

      <button className="botao cheio" disabled={!valido} onClick={salvar}>Salvar</button>
      {existente && (
        <button className="botao perigo cheio" onClick={async () => {
          const n = d.lancamentos.filter(l => l.forma === existente.id).length;
          if (!confirm(n ? `Apagar o cartão e os ${n} lançamentos dele?` : 'Apagar o cartão?')) return;
          await db.transaction('rw', db.cartoes, db.lancamentos, db.faturas, async () => {
            await db.lancamentos.where('forma').equals(existente.id).delete();
            await db.faturas.where('cartaoId').equals(existente.id).delete();
            await db.cartoes.delete(existente.id);
          });
          ir('ajustes');
        }}>Apagar cartão</button>
      )}
    </main>
  );
}

function EditorConsignado() {
  const d = useDados();
  const reg = d.consignado;
  const estadoAtual = d.situacao.consignado;
  const [f, setF] = useState({
    banco: reg?.banco ?? '',
    parcela: reg?.cfg.parcelaCentavos,
    total: reg?.totalParcelas ?? 120,
    taxa: reg ? Math.round(reg.taxaMes * 10000) / 100 : 2,
    k: reg?.cfg.k,
    base: reg?.cfg.base,
    mesBase: reg?.cfg.mesBase ?? '',
    menor: reg ? estadoAtual.menorAberta : 1,
    maior: reg ? estadoAtual.maiorAberta : 120,
    nominalMaior: reg ? estadoAtual.nominalMaiorCentavos : undefined,
  });
  const valido = f.parcela && f.parcela > 0 && f.total > 0 && f.menor >= 1 && f.maior >= f.menor && f.maior <= f.total;

  async function salvar() {
    if (!valido) return;
    const taxa = f.taxa / 100;
    const registro: ConsignadoDb = {
      contrato: reg?.contrato ?? 'consignado',
      banco: f.banco.trim() || 'Consignado',
      cfg: {
        parcelaCentavos: f.parcela!,
        // Sem calibração do extrato: k = parcela e base = 1 + taxa (o desconto composto da própria taxa).
        k: f.k ?? f.parcela! / 100,
        base: f.base ?? 1 + taxa,
        mesBase: f.mesBase || somarMeses(d.situacao.mesInicial, -f.menor),
      },
      totalParcelas: f.total,
      taxaMes: taxa,
      estado: { menorAberta: f.menor, maiorAberta: f.maior, nominalMaiorCentavos: f.nominalMaior ?? f.parcela! },
      estadoEm: d.situacao.mesInicial,
    };
    await db.transaction('rw', db.consignado, db.metas, db.cenarios, async () => {
      await db.consignado.put(registro);
      if (!(await db.metas.get('consignado'))) await db.metas.put({ id: 'consignado', nome: 'Quitar consignado', saldoCentavos: 0, ordem: 2 });
      // Entra nas prioridades do plano ativo, logo depois da primeira meta.
      if (!d.parametros.destinos.some(x => x.metaId === 'consignado')) {
        const destinos = [...d.parametros.destinos].sort((a, b) => a.ordem - b.ordem);
        destinos.splice(Math.min(1, destinos.length), 0, { metaId: 'consignado', ordem: 0 });
        await db.cenarios.update(d.cenario.id, { parametros: { ...d.parametros, destinos: destinos.map((x, i) => ({ ...x, ordem: i + 1 })) } });
      }
    });
    toast('Consignado salvo');
    ir('consignado');
  }

  const mesBaseAjuda = 'm = meses desde o mês-base. Vazio: a menor parcela aberta custa o valor cheio neste mês. Com k e base calibrados no extrato, os custos batem com o banco.';

  return (
    <main className="tela">
      <Topo titulo="Consignado" comVoltar />
      <section className="cartao coluna">
        <CampoTexto rotulo="Banco" valor={f.banco} onChange={banco => setF({ ...f, banco })} />
        <div className="grade-2">
          <CampoValor rotulo="Parcela" valor={f.parcela} onChange={parcela => setF({ ...f, parcela })} />
          <CampoNumero rotulo="Total de parcelas" valor={f.total} onChange={v => setF({ ...f, total: v ?? 0 })} />
        </div>
        <CampoNumero rotulo="Taxa ao mês" sufixo="%" passo={0.01} valor={f.taxa} onChange={v => setF({ ...f, taxa: v ?? 0 })} />
        <h3>Situação hoje</h3>
        <div className="grade-2">
          <CampoNumero rotulo="Menor parcela aberta" valor={f.menor} onChange={v => setF({ ...f, menor: v ?? 1 })} />
          <CampoNumero rotulo="Maior parcela aberta" valor={f.maior} onChange={v => setF({ ...f, maior: v ?? 1 })} />
        </div>
        <CampoValor rotulo="Quanto falta da maior (se parcial)" valor={f.nominalMaior} onChange={nominalMaior => setF({ ...f, nominalMaior })} />
      </section>
      <details className="cartao">
        <summary style={{ fontWeight: 700, cursor: 'pointer' }}>Fórmula de antecipação (avançado)</summary>
        <div className="coluna" style={{ marginTop: 12 }}>
          <p className="pequeno fraco">custo(t, m) = k × base^m / base^t. {mesBaseAjuda}</p>
          <div className="grade-2">
            <CampoNumero rotulo="k (R$)" passo={0.01} valor={f.k} onChange={k => setF({ ...f, k })} />
            <CampoNumero rotulo="base" passo={0.000001} valor={f.base} onChange={base => setF({ ...f, base })} />
          </div>
          <CampoTexto rotulo="Mês-base" tipo="month" valor={f.mesBase} onChange={mesBase => setF({ ...f, mesBase })} />
        </div>
      </details>
      {!valido && <Aviso nivel="atencao" titulo="Confira a parcela e as parcelas abertas" />}
      <button className="botao cheio" disabled={!valido} onClick={salvar}>Salvar</button>
      {reg && (
        <button className="botao perigo cheio" onClick={async () => {
          if (!confirm('Remover o consignado?')) return;
          await db.consignado.delete(reg.contrato);
          ir('ajustes');
        }}>Remover consignado</button>
      )}
    </main>
  );
}
