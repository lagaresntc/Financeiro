import { useState } from 'react';
import { db } from '../../db/db';
import { useDados, nomeMeta, type Dados } from '../dados';
import { Aviso, Barra, CampoTexto, CampoValor, Reais, Topo, toast } from '../componentes';
import { href } from '../rotas';
import type { Destino, Mes } from '../../domain/tipos';
import { ID_CONSIGNADO, ID_INVESTIMENTOS } from '../../domain/projecao';
import { aporteMensalParaMeta, fracaoConcluida, taxaMensalDoCdi } from '../../domain/metas';
import { formatarMes, mesDe, mesesEntre, somarMeses } from '../../domain/datas';
import { formatarReais } from '../../domain/dinheiro';

/** Atualiza um destino do cenário ativo (alvo, prazo…). */
async function atualizarDestino(d: Dados, metaId: string, mudancas: Partial<Destino>) {
  const destinos = d.parametros.destinos.map(x => (x.metaId === metaId ? { ...x, ...mudancas } : x));
  await db.cenarios.update(d.cenario.id, { parametros: { ...d.parametros, destinos } });
}

export default function Plano() {
  const d = useDados();
  const destinos = [...d.parametros.destinos].sort((a, b) => a.ordem - b.ordem).filter(x => x.metaId !== ID_CONSIGNADO);
  const investimentos = d.metas.find(m => m.id === ID_INVESTIMENTOS);

  return (
    <main className="tela">
      <Topo titulo="Metas" acao={<a className="botao pequeno secundario" href={href('plano', 'editor')}>Editar plano</a>} />
      {destinos.length === 0 && <p className="vazio">Nenhuma meta ainda. Crie a primeira abaixo.</p>}
      {destinos.map(x => <CartaoMeta key={x.metaId} destino={x} />)}
      {investimentos && investimentos.saldoCentavos > 0 && !destinos.some(x => x.metaId === ID_INVESTIMENTOS) && (
        <section className="cartao linha"><strong>Investimentos (o que passou das metas)</strong><Reais v={investimentos.saldoCentavos} /></section>
      )}
      <NovaMeta />
      <section className="cartao">
        <div className="lista">
          <a href={href('projecao')} className="linha" style={{ textDecoration: 'none', color: 'inherit' }}><span>Projeção mês a mês e checklist</span><span className="fraco">›</span></a>
          <a href={href('plano', 'cenarios')} className="linha" style={{ textDecoration: 'none', color: 'inherit' }}><span>Cenários (e se…?)</span><span className="fraco">›</span></a>
        </div>
      </section>
    </main>
  );
}

function CartaoMeta({ destino }: { destino: Destino }) {
  const d = useDados();
  const id = destino.metaId;
  const meta = d.metas.find(m => m.id === id);
  const saldo = meta?.saldoCentavos ?? 0;
  const alvo = destino.alvoCentavos;
  const fracao = fracaoConcluida(saldo, alvo);
  const mesAtual = mesDe(d.hoje);
  const previsto = d.projecao.datas[id];
  const aportesMeta = d.aportes.filter(a => a.metaId === id);
  const guardadoNoMes = aportesMeta.filter(a => a.mes === mesAtual).reduce((s, a) => s + a.valorCentavos, 0);

  const [registrando, setRegistrando] = useState(false);
  const [valor, setValor] = useState<number | undefined>();
  const [mes, setMes] = useState<Mes>(mesAtual);
  const [verHistorico, setVerHistorico] = useState(false);

  // Quanto guardar por mês, de agora até o prazo, contando o rendimento da Caixinha.
  const taxa = taxaMensalDoCdi(d.parametros.premissas.cdiAnual, d.parametros.premissas.caixinhaPctCdi);
  const prazo = destino.prazo;
  const meses = prazo ? mesesEntre(mesAtual, prazo) + 1 : 0;
  const porMes = prazo && alvo ? aporteMensalParaMeta(alvo, saldo - guardadoNoMes, meses, taxa) : null;

  async function registrar(sinal: 1 | -1) {
    if (!valor) return;
    const v = sinal * valor;
    await db.transaction('rw', db.aportes, db.metas, async () => {
      await db.aportes.add({ metaId: id, mes, valorCentavos: v, data: d.hoje });
      if (meta) await db.metas.update(id, { saldoCentavos: meta.saldoCentavos + v });
      else await db.metas.add({ id, nome: nomeMeta(id, d.metas), saldoCentavos: v, ordem: 99 });
    });
    toast(`${sinal > 0 ? 'Guardado' : 'Retirado'}: ${formatarReais(valor)} em ${nomeMeta(id, d.metas)}`);
    setValor(undefined);
    setRegistrando(false);
  }

  return (
    <section className="cartao coluna">
      <div className="linha">
        <h2 style={{ margin: 0 }}>{nomeMeta(id, d.metas)}</h2>
        {alvo ? <strong style={{ fontSize: '1.4rem' }}>{Math.floor(fracao * 100)}%</strong> : null}
      </div>
      {alvo ? <Barra fracao={fracao} /> : null}
      <div className="linha pequeno">
        <span><Reais v={saldo} />{alvo ? <> de <Reais v={alvo} /></> : ' guardados'}</span>
        {alvo && saldo < alvo && <span className="fraco">faltam <Reais v={alvo - saldo} /></span>}
        {alvo && saldo >= alvo && <span className="verde">Concluída ✓</span>}
      </div>
      {alvo && saldo < alvo && previsto && <span className="pequeno fraco">Pelo plano atual, fica pronta em {formatarMes(previsto)}.</span>}

      {alvo !== undefined && saldo < (alvo ?? 0) && (
        <div className="grade-2">
          <CampoTexto rotulo="Quero pronta em" tipo="month" valor={prazo ?? ''} onChange={v => atualizarDestino(d, id, { prazo: v || undefined })} />
          <CampoValor rotulo="Alvo" valor={alvo} onChange={v => v !== undefined && atualizarDestino(d, id, { alvoCentavos: v })} />
        </div>
      )}
      {porMes !== null && prazo && (
        meses <= 0
          ? <Aviso nivel="perigo" titulo="Esse mês já passou">Escolha um prazo a partir de {formatarMes(mesAtual)}.</Aviso>
          : (
            <Aviso nivel={guardadoNoMes >= porMes ? 'ok' : 'info'} titulo={`Guarde ${formatarReais(porMes)} por mês`}>
              {meses === 1 ? `Tudo em ${formatarMes(prazo)}` : `De ${formatarMes(mesAtual)} a ${formatarMes(prazo)} (${meses} meses)`}, já contando o rendimento.
              {guardadoNoMes > 0 && (guardadoNoMes >= porMes
                ? ` Este mês já está feito (${formatarReais(guardadoNoMes)}).`
                : ` Este mês: ${formatarReais(guardadoNoMes)} guardados, faltam ${formatarReais(porMes - guardadoNoMes)}.`)}
            </Aviso>
          )
      )}

      {!registrando ? (
        <button className="botao secundario cheio" onClick={() => setRegistrando(true)}>
          Registrar quanto guardei{guardadoNoMes ? ` (${formatarReais(guardadoNoMes)} em ${formatarMes(mesAtual)})` : ''}
        </button>
      ) : (
        <div className="cartao coluna" style={{ background: 'var(--superficie-2)' }}>
          <div className="grade-2">
            <CampoValor rotulo="Valor" valor={valor} onChange={setValor} autoFocus />
            <CampoTexto rotulo="Mês" tipo="month" valor={mes} onChange={v => v && setMes(v)} />
          </div>
          <div className="linha">
            <button className="botao secundario pequeno" onClick={() => setRegistrando(false)}>Cancelar</button>
            <button className="botao secundario pequeno" onClick={() => registrar(-1)} disabled={!valor}>Tirei</button>
            <button className="botao pequeno" onClick={() => registrar(1)} disabled={!valor}>Guardei</button>
          </div>
        </div>
      )}

      {aportesMeta.length > 0 && (
        <>
          <button className="link pequeno" style={{ alignSelf: 'flex-start' }} onClick={() => setVerHistorico(!verHistorico)}>
            {verHistorico ? 'Esconder histórico' : `Ver histórico (${aportesMeta.length})`}
          </button>
          {verHistorico && (
            <div className="lista">
              {aportesMeta.map(a => (
                <div key={a.id} className="linha pequeno">
                  <span>{formatarMes(a.mes)}</span>
                  <span>
                    <span className={a.valorCentavos < 0 ? 'vermelho' : 'verde'}><Reais v={a.valorCentavos} sinal /></span>{' '}
                    <button className="link vermelho" aria-label="Apagar registro" onClick={async () => {
                      if (a.id === undefined || !confirm('Apagar este registro? O saldo da meta volta junto.')) return;
                      await db.transaction('rw', db.aportes, db.metas, async () => {
                        await db.aportes.delete(a.id!);
                        const m = await db.metas.get(id);
                        if (m) await db.metas.update(id, { saldoCentavos: m.saldoCentavos - a.valorCentavos });
                      });
                    }}>✕</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function NovaMeta() {
  const d = useDados();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [alvo, setAlvo] = useState<number | undefined>();
  const [prazo, setPrazo] = useState(somarMeses(mesDe(d.hoje), 12));

  async function criar() {
    if (!nome.trim() || !alvo) return;
    const id = `meta-${Math.random().toString(36).slice(2, 8)}`;
    const ordem = Math.max(0, ...d.parametros.destinos.map(x => x.ordem)) + 1;
    await db.transaction('rw', db.metas, db.cenarios, async () => {
      await db.metas.add({ id, nome: nome.trim(), alvoCentavos: alvo, saldoCentavos: 0, ordem });
      await db.cenarios.update(d.cenario.id, {
        parametros: { ...d.parametros, destinos: [...d.parametros.destinos, { metaId: id, ordem, alvoCentavos: alvo, prazo }] },
      });
    });
    toast(`Meta criada: ${nome.trim()}`);
    setAberto(false);
    setNome('');
    setAlvo(undefined);
  }

  if (!aberto) return <button className="botao cheio" onClick={() => setAberto(true)}>+ Nova meta</button>;
  return (
    <section className="cartao coluna">
      <h2>Nova meta</h2>
      <CampoTexto rotulo="Nome" valor={nome} onChange={setNome} placeholder="Ex.: Viagem, Carro, Reserva" />
      <div className="grade-2">
        <CampoValor rotulo="Valor da meta" valor={alvo} onChange={setAlvo} />
        <CampoTexto rotulo="Quero pronta em" tipo="month" valor={prazo} onChange={v => v && setPrazo(v)} />
      </div>
      <p className="pequeno fraco">Ela entra no fim da fila de prioridades. A ordem muda no editor do plano.</p>
      <div className="linha">
        <button className="botao secundario pequeno" onClick={() => setAberto(false)}>Cancelar</button>
        <button className="botao pequeno" onClick={criar} disabled={!nome.trim() || !alvo}>Criar meta</button>
      </div>
    </section>
  );
}
