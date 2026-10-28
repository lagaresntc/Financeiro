import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { useDados, nomeMeta } from '../dados';
import { Aviso, Barra, CampoTexto, CampoValor, Chips, Passo, Reais, Topo, toast } from '../componentes';
import { ir } from '../rotas';
import { compararParcelamentos, simularCompra, type LinhaSimulacao } from '../../domain/simulador';
import { quitado } from '../../domain/consignado';
import { formatarData, formatarMes, somarMeses } from '../../domain/datas';
import { formatarReais } from '../../domain/dinheiro';

const SEM_CARTAO = 'carne';
const A_VISTA = 'pix';
const OPCOES = [1, 2, 3, 4, 6, 10, 12];

export default function Simular() {
  const d = useDados();
  const principal = d.cartoes.find(c => c.principal) ?? d.cartoes[0];
  const [valor, setValor] = useState<number | undefined>();
  const [parcelas, setParcelas] = useState(3);
  const [forma, setForma] = useState(principal?.id ?? SEM_CARTAO);
  const [data, setData] = useState(d.hoje);
  const [descricao, setDescricao] = useState('');
  const cartao = d.cartoes.find(c => c.id === forma);
  const aVista = forma === A_VISTA;
  const n = aVista ? 1 : parcelas;

  const compra = { valorCentavos: valor ?? 0, forma, data, descricao };
  const sim = useMemo(
    () => (valor ? simularCompra(d.situacao, d.parametros, { ...compra, parcelas: n }) : null),
    [valor, n, forma, data, descricao, d.situacao, d.parametros],
  );
  const opcoes = useMemo(
    () => (valor && !aVista ? compararParcelamentos(d.situacao, d.parametros, compra, OPCOES) : []),
    [valor, aVista, forma, data, d.situacao, d.parametros],
  );
  const atrasos = sim ? Object.entries(sim.atrasos).filter(([, m]) => m > 0) : [];
  const temConsignado = !!d.consignado && !quitado(d.situacao.consignado);

  async function confirmar() {
    if (!valor || !sim) return;
    const desc = descricao.trim() || 'Compra';
    if (cartao || aVista) {
      await db.lancamentos.add({
        data, valorCentavos: sim.valorParcelaCentavos, forma: cartao ? cartao.id : 'pix', categoria: 'Outros', descricao: desc,
        parcelas: n, parcelaInicial: 1, grupoParcelaId: n > 1 ? crypto.randomUUID() : undefined,
        origem: 'manual', criadoEm: new Date().toISOString(),
      });
    } else {
      // Parcelado sem cartão (carnê, boleto): cada parcela vira uma saída certa no mês.
      await db.eventos.bulkAdd(Array.from({ length: n }, (_, i) => ({
        data: `${somarMeses(sim.primeiraCompetencia, i)}-10`, titulo: `${desc} (${i + 1}/${n})`, valorCentavos: sim.valorParcelaCentavos, tipo: 'saida',
      })));
    }
    toast('Compra lançada');
    ir('inicio');
  }

  const formas = [
    ...d.cartoes.map(c => ({ valor: c.id, rotulo: c.nome })),
    { valor: SEM_CARTAO, rotulo: 'Parcelado sem cartão' },
    { valor: A_VISTA, rotulo: 'À vista' },
  ];

  return (
    <main className="tela">
      <Topo titulo="Simular compra" />
      <section className="cartao coluna">
        <CampoValor rotulo="Valor total da compra" valor={valor} onChange={setValor} grande />
        <span className="pequeno fraco">Como vai pagar</span>
        <Chips opcoes={formas} valor={forma} onChange={setForma} />
        {!aVista && (
          <div className="linha">
            <span className="pequeno fraco">Parcelas{valor ? <> · <Reais v={Math.ceil(valor / n)} /> cada</> : ''}</span>
            <Passo valor={parcelas} onChange={setParcelas} sufixo="x" />
          </div>
        )}
        <div className="grade-2">
          <CampoTexto rotulo="Data da compra" tipo="date" valor={data} onChange={v => v && setData(v)} />
          <CampoTexto rotulo="O quê (opcional)" valor={descricao} onChange={setDescricao} />
        </div>
      </section>

      {!valor && <p className="vazio">Digite o valor para ver quanto cada parcela pesa em cada mês.</p>}

      {sim && (
        <>
          <Aviso
            nivel={sim.cabe ? 'ok' : 'perigo'}
            titulo={sim.cabe ? `${n}x de ${formatarReais(sim.valorParcelaCentavos)} cabe na folga` : `${n}x come ${formatarReais(sim.comeDaMetaCentavos)} da meta em ${sim.mesesQueComemMeta} ${sim.mesesQueComemMeta === 1 ? 'mês' : 'meses'}`}
          >
            {n > 1
              ? `De ${formatarMes(sim.primeiraCompetencia)} a ${formatarMes(somarMeses(sim.primeiraCompetencia, n - 1))}${sim.vencimentoPrimeira ? `, 1ª fatura vence ${formatarData(sim.vencimentoPrimeira)}` : ''}.`
              : `Sai em ${formatarMes(sim.primeiraCompetencia)}.`}
            {atrasos.length > 0 && ` Atrasa: ${atrasos.map(([id, m]) => `${nomeMeta(id, d.metas)} em ${m} ${m === 1 ? 'mês' : 'meses'}`).join(', ')}.`}
          </Aviso>

          {opcoes.length > 0 && (
            <section className="cartao coluna">
              <h2>Comparar parcelamentos</h2>
              <p className="pequeno fraco">Toque numa linha para escolher.</p>
              <div className="lista">
                {opcoes.map(o => (
                  <button
                    key={o.parcelas}
                    className="linha"
                    onClick={() => setParcelas(o.parcelas)}
                    style={{ border: 0, background: o.parcelas === n ? 'var(--superficie-2)' : 'none', textAlign: 'left', cursor: 'pointer', borderRadius: 10, padding: '10px 8px', color: 'inherit' }}
                  >
                    <span><strong>{o.parcelas}x</strong> <Reais v={o.valorParcelaCentavos} /><span className="pequeno fraco"> até {formatarMes(o.ultimoMes)}</span></span>
                    <span className={`pequeno ${o.cabe ? 'verde' : 'vermelho'}`}>
                      {o.cabe ? 'Cabe ✓' : `Come ${formatarReais(o.comeDaMetaCentavos)}`}{o.atrasoMaximo > 0 ? ` · atrasa ${o.atrasoMaximo}m` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="cartao coluna">
            <h2>Impacto em cada mês</h2>
            <p className="pequeno fraco">Folga livre: o que sobra no mês depois das contas, do orçamento, da meta de guardar e da margem mínima.</p>
            <div className="lista">
              {sim.linhas.map(l => <LinhaImpacto key={l.mes} linha={l} total={n} margem={d.parametros.premissas.margemMinimaCentavos} />)}
            </div>
          </section>

          {cartao && sim.melhorDia && sim.melhorDia !== data && (
            <Aviso nivel="info" titulo={`Compre a partir de ${formatarData(sim.melhorDia)}`}>
              É o melhor dia do {cartao.nome}: a 1ª parcela cai em {formatarMes(sim.primeiraCompetenciaNoMelhorDia!)}, com mais prazo.
            </Aviso>
          )}
          {n > 4 && <Aviso nivel="atencao" titulo="Parcelamento longo se empilha">De preferência, só sem juros e até 4x.</Aviso>}
          {temConsignado && <Aviso nivel="info" titulo="À vista só compensa com desconto acima de ~12%">Enquanto o consignado existir, cada real livre rende mais amortizando.</Aviso>}
          <button className="botao cheio" onClick={confirmar}>Confirmar compra (lançar)</button>
        </>
      )}
    </main>
  );
}

function LinhaImpacto({ linha: l, total, margem }: { linha: LinhaSimulacao; total: number; margem: number }) {
  const comeMeta = l.metaDepoisCentavos < l.metaAntesCentavos;
  const livreAntes = Math.max(0, l.folgaAntesCentavos - margem);
  const livreDepois = Math.max(0, l.folgaDepoisCentavos - margem);
  const usa = livreAntes > 0 ? l.parcelaCentavos / livreAntes : 1;
  return (
    <div className="coluna" style={{ gap: 6 }}>
      <div className="linha">
        <span><strong>{formatarMes(l.mes)}</strong>{total > 1 && <span className="pequeno fraco"> · parcela {l.parcela}/{total}</span>}</span>
        <strong><Reais v={l.parcelaCentavos} /></strong>
      </div>
      <Barra fracao={usa} nivel={comeMeta ? 'perigo' : usa > 0.5 ? 'atencao' : undefined} />
      <div className="linha pequeno">
        <span className="fraco">Folga livre <Reais v={livreAntes} /> → <Reais v={livreDepois} /></span>
        <span className={comeMeta ? 'vermelho' : usa > 0.5 ? 'amarelo' : 'fraco'}>
          {comeMeta ? `tira ${formatarReais(l.metaAntesCentavos - l.metaDepoisCentavos)} da meta` : `usa ${Math.round(usa * 100)}% da folga`}
        </span>
      </div>
      {l.rendaCentavos > 0 && <span className="pequeno fraco">{((l.parcelaCentavos / l.rendaCentavos) * 100).toFixed(1).replace('.', ',')}% da renda do mês</span>}
    </div>
  );
}
