import { useState } from 'react';
import { db } from '../../db/db';
import { useDados, type Dados } from '../dados';
import { Barra, CampoValor, Reais, Topo, toast } from '../componentes';
import { calcularTetos, temRenda } from '../tetos';
import type { TetoFatura } from '../../domain/tetoFatura';
import { href } from '../rotas';
import type { CartaoDb } from '../../db/schema';
import type { Mes } from '../../domain/tipos';
import { datasDaFatura } from '../../domain/faturas';
import { formatarData, formatarDiaMes, formatarMes, somarMeses } from '../../domain/datas';
import { cartaoCfg, faturaAbertaHoje, itensDaFatura, totalDaFatura } from '../../db/situacao';

type Status = 'aberta' | 'fechada' | 'paga' | 'futura';

function statusDa(d: Dados, cartao: CartaoDb, comp: Mes): Status {
  const cfg = cartaoCfg(cartao);
  const f = d.faturas.find(x => x.cartaoId === cartao.id && x.competencia === comp);
  if (f?.status === 'paga') return 'paga';
  const aberta = faturaAbertaHoje(cfg, d.hoje);
  if (comp === aberta) return 'aberta';
  return comp > aberta ? 'futura' : 'fechada';
}

const NOME_STATUS: Record<Status, string> = { aberta: 'Aberta', fechada: 'Fechada', paga: 'Paga', futura: 'Futura' };

export default function Cartoes({ rota }: { rota: string[] }) {
  const d = useDados();
  const [id, comp] = rota;
  const cartao = d.cartoes.find(c => c.id === id);
  if (cartao && comp) return <DetalheFatura cartao={cartao} comp={comp} />;
  if (cartao) return <FaturasDoCartao cartao={cartao} />;

  const tetos = calcularTetos(d, 1);
  const semRenda = !temRenda(d);
  return (
    <main className="tela">
      <Topo titulo="Cartões" acao={<a className="botao pequeno secundario" href={href('ajustes', 'cartao', 'novo')}>+ Cartão</a>} />
      {d.cartoes.length === 0 && <p className="vazio">Nenhum cartão cadastrado.</p>}
      {d.cartoes.length > 0 && semRenda && (
        <p className="pequeno fraco">Cadastre sua renda no <a href={href('plano', 'editor')}>editor do plano</a> para ver até quanto cada fatura pode chegar.</p>
      )}
      {d.cartoes.map(c => {
        const cfg = cartaoCfg(c);
        const aberta = faturaAbertaHoje(cfg, d.hoje);
        const comps = [somarMeses(aberta, -1), aberta, somarMeses(aberta, 1)];
        return (
          <section key={c.id} className="cartao">
            <div className="linha">
              <h2>{c.nome}</h2>
              <a className="pequeno" href={href('cartoes', c.id)}>Todas as faturas</a>
            </div>
            <p className="pequeno fraco" style={{ marginBottom: 8 }}>
              Fecha dia {c.diaFechamento} · vence dia {c.diaVencimento}{c.limiteCentavos ? <> · limite <Reais v={c.limiteCentavos} /></> : null}
            </p>
            {!semRenda && [aberta, somarMeses(aberta, 1)].map(m => {
              const t = tetos.get(`${c.id}|${m}`);
              return t ? <TetoDaFatura key={m} teto={t} /> : null;
            })}
            <div className="lista">
              {comps.map(m => <LinhaFatura key={m} d={d} cartao={c} comp={m} />)}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function LinhaFatura({ d, cartao, comp }: { d: Dados; cartao: CartaoDb; comp: Mes }) {
  const cfg = cartaoCfg(cartao);
  const fatura = d.faturas.find(f => f.cartaoId === cartao.id && f.competencia === comp);
  const st = statusDa(d, cartao, comp);
  const { vencimento } = datasDaFatura(cfg, comp);
  return (
    <a href={href('cartoes', cartao.id, comp)} className="linha" style={{ textDecoration: 'none', color: 'inherit' }}>
      <span>
        <span className={`selo ${st}`}>{NOME_STATUS[st]}</span>{' '}
        <span className="pequeno">{formatarMes(comp)} · vence {formatarDiaMes(vencimento)}</span>
      </span>
      <strong><Reais v={totalDaFatura(cfg, comp, d.lancamentos, fatura)} /></strong>
    </a>
  );
}

function FaturasDoCartao({ cartao }: { cartao: CartaoDb }) {
  const d = useDados();
  const aberta = faturaAbertaHoje(cartaoCfg(cartao), d.hoje);
  const comps = Array.from({ length: 16 }, (_, i) => somarMeses(aberta, i - 3));
  const cfg = cartaoCfg(cartao);
  const visiveis = comps.filter(m => m >= aberta || totalDaFatura(cfg, m, d.lancamentos, d.faturas.find(f => f.cartaoId === cartao.id && f.competencia === m)) > 0);
  return (
    <main className="tela">
      <Topo titulo={cartao.nome} comVoltar acao={<a className="botao pequeno secundario" href={href('ajustes', 'cartao', cartao.id)}>Configurar</a>} />
      <section className="cartao">
        <div className="lista">
          {visiveis
            .filter(m => m <= aberta || itensDaFatura(cfg, m, d.lancamentos).length > 0)
            .map(m => <LinhaFatura key={m} d={d} cartao={cartao} comp={m} />)}
        </div>
      </section>
    </main>
  );
}

function DetalheFatura({ cartao, comp }: { cartao: CartaoDb; comp: Mes }) {
  const d = useDados();
  const cfg = cartaoCfg(cartao);
  const fatura = d.faturas.find(f => f.cartaoId === cartao.id && f.competencia === comp);
  const itens = itensDaFatura(cfg, comp, d.lancamentos);
  const total = totalDaFatura(cfg, comp, d.lancamentos, fatura);
  const st = statusDa(d, cartao, comp);
  const { fechamento, vencimento } = datasDaFatura(cfg, comp);
  const [informado, setInformado] = useState<number | undefined>(fatura?.saldoInformadoCentavos);
  const somaItens = itens.reduce((s, i) => s + i.valorCentavos, 0);

  async function salvarFatura(mudancas: Partial<NonNullable<typeof fatura>>) {
    if (fatura?.id !== undefined) await db.faturas.update(fatura.id, mudancas);
    else await db.faturas.add({ cartaoId: cartao.id, competencia: comp, status: 'aberta', ...mudancas });
  }

  return (
    <main className="tela">
      <Topo titulo={`${cartao.nome} · ${formatarMes(comp)}`} comVoltar />
      <section className="cartao coluna">
        <div className="linha"><span className={`selo ${st}`}>{NOME_STATUS[st]}</span><span className="pequeno fraco">Fecha {formatarData(fechamento)} · vence {formatarData(vencimento)}</span></div>
        <span className="numero-grande"><Reais v={total} /></span>
        {fatura?.saldoInformadoCentavos !== undefined && (
          <span className="pequeno fraco">
            Saldo do app do banco: <Reais v={fatura.saldoInformadoCentavos} />{fatura.dataInformado ? ` em ${formatarDiaMes(fatura.dataInformado)}` : ''}
            {total !== fatura.saldoInformadoCentavos && <> + lançamentos depois</>}
          </span>
        )}
        <button
          className={`botao cheio ${st === 'paga' ? 'secundario' : ''}`}
          onClick={async () => {
            const paga = st !== 'paga';
            await salvarFatura({ status: paga ? 'paga' : 'aberta', pagaEm: paga ? d.hoje : undefined });
            toast(paga ? 'Fatura marcada como paga' : 'Fatura desmarcada');
          }}
        >
          {st === 'paga' ? 'Desmarcar pagamento' : 'Marcar como paga'}
        </button>
      </section>

      <section className="cartao coluna">
        <h2>Conferir com o app do banco</h2>
        <p className="pequeno fraco">Informe o saldo que aparece no app. Ele passa a valer na projeção até a fatura ser paga; o que você lançar depois soma por cima.</p>
        <CampoValor rotulo="Saldo informado" valor={informado} onChange={setInformado} />
        <div className="linha">
          <button className="botao secundario pequeno" onClick={async () => { await salvarFatura({ saldoInformadoCentavos: informado, dataInformado: d.hoje }); toast('Saldo salvo'); }} disabled={informado === undefined}>Salvar saldo</button>
          {fatura?.saldoInformadoCentavos !== undefined && (
            <button className="link" onClick={async () => { await salvarFatura({ saldoInformadoCentavos: undefined, dataInformado: undefined }); setInformado(undefined); }}>Usar só os lançamentos</button>
          )}
        </div>
        {informado !== undefined && somaItens > 0 && informado !== somaItens && (
          <p className="pequeno fraco">Lançado no app: <Reais v={somaItens} /> (diferença <Reais v={informado - somaItens} />)</p>
        )}
      </section>

      <section className="cartao">
        <h2>Lançamentos e parcelas</h2>
        {itens.length === 0 ? <p className="vazio">Nada lançado nesta fatura.</p> : (
          <div className="lista">
            {itens.map(i => (
              <div key={`${i.lancamento.id}-${i.parcela}`} className="linha">
                <div className="coluna" style={{ gap: 2 }}>
                  <span>{i.lancamento.descricao}</span>
                  <span className="pequeno fraco">
                    {formatarDiaMes(i.lancamento.data)} · {i.lancamento.categoria}{i.lancamento.parcelas > 1 ? ` · ${i.parcela}/${i.lancamento.parcelas}` : ''}
                  </span>
                </div>
                <div className="coluna" style={{ gap: 2, alignItems: 'flex-end' }}>
                  <strong><Reais v={i.valorCentavos} /></strong>
                  {i.lancamento.origem !== 'seed' && (
                    <button
                      className="link pequeno vermelho"
                      onClick={async () => {
                        const msg = i.lancamento.parcelas > 1 ? `Apagar a compra "${i.lancamento.descricao}" e todas as ${i.lancamento.parcelas} parcelas?` : `Apagar "${i.lancamento.descricao}"?`;
                        if (i.lancamento.id !== undefined && confirm(msg)) await db.lancamentos.delete(i.lancamento.id);
                      }}
                    >Apagar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/** "Esta fatura pode chegar a R$ X sem estourar o mês." */
function TetoDaFatura({ teto: t }: { teto: TetoFatura }) {
  const estourou = t.restaCentavos < 0;
  const semEspaco = t.tetoCentavos <= 0;
  return (
    <div className="coluna" style={{ gap: 4, padding: '8px 0' }}>
      <div className="linha pequeno">
        <span>Fatura de {formatarMes(t.competencia)}: máximo <strong><Reais v={Math.max(0, t.tetoCentavos)} /></strong></span>
        <span className={estourou ? 'vermelho' : 'verde'}>
          {semEspaco ? 'sem espaço no mês' : estourou ? <>passou <Reais v={-t.restaCentavos} /></> : <>cabem <Reais v={t.restaCentavos} /></>}
        </span>
      </div>
      <Barra fracao={t.tetoCentavos > 0 ? t.atualCentavos / t.tetoCentavos : 1} nivel={estourou || semEspaco ? 'perigo' : t.atualCentavos > t.tetoCentavos * 0.8 ? 'atencao' : undefined} />
      <span className="pequeno fraco">Já tem <Reais v={t.atualCentavos} /> nela. Acima do máximo, a fatura tira dinheiro da meta do mês.</span>
    </div>
  );
}
