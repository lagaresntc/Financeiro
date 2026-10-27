import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { aplicarSeed, seedJaAplicado } from '../db/seed';
import type { DadosIniciais } from '../db/mapearSeed';
import type { SituacaoAtual } from '../domain/tipos';
import { projetar, ID_CONSIGNADO } from '../domain/projecao';
import { formatarReais } from '../domain/dinheiro';
import { formatarMes } from '../domain/datas';
import styles from './App.module.css';

// Em desenvolvimento, o seed vem do arquivo local. No build de produção ele nunca é embutido.
const seedsDev = import.meta.env.DEV
  ? import.meta.glob<DadosIniciais>('../../data/dados-iniciais.json', { import: 'default' })
  : {};

type Estado = 'carregando' | 'sem-dados' | 'pronto';

export default function App() {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (await seedJaAplicado(db)) return setEstado('pronto');
      const carregar = Object.values(seedsDev)[0];
      if (carregar) {
        await aplicarSeed(db, await carregar());
        return setEstado('pronto');
      }
      setEstado('sem-dados');
    })().catch(e => setErro(String(e)));
  }, []);

  async function escolherArquivo(arquivo: File) {
    try {
      await aplicarSeed(db, JSON.parse(await arquivo.text()) as DadosIniciais);
      setEstado('pronto');
    } catch (e) {
      setErro(`Não consegui ler o arquivo: ${String(e)}`);
    }
  }

  if (erro) return <main className={styles.tela}><p className={styles.erro}>{erro}</p></main>;
  if (estado === 'carregando') return <main className={styles.tela}><p>Carregando…</p></main>;
  if (estado === 'sem-dados') {
    return (
      <main className={styles.tela}>
        <h1>Gerente Financeiro</h1>
        <p>Primeira abertura: escolha o arquivo <code>dados-iniciais.json</code>. Ele fica só neste aparelho.</p>
        <label className={styles.botao}>
          Escolher arquivo
          <input type="file" accept="application/json,.json" hidden onChange={e => e.target.files?.[0] && escolherArquivo(e.target.files[0])} />
        </label>
      </main>
    );
  }
  return <Resumo />;
}

function Resumo() {
  const cenario = useLiveQuery(() => db.cenarios.filter(c => c.ativo).first());
  const situacao = useLiveQuery(() => db.config.get('situacaoInicial'));
  const projecao = useMemo(
    () => (cenario && situacao ? projetar(situacao.valor as SituacaoAtual, cenario.parametros, { horizonteMeses: 36 }) : null),
    [cenario, situacao],
  );
  if (!cenario || !projecao) return <main className={styles.tela}><p>Carregando…</p></main>;

  const data = (id: string) => (projecao.datas[id] ? formatarMes(projecao.datas[id]) : '—');
  const ultimo = projecao.datas.chacara ?? projecao.meses[projecao.meses.length - 1]!.mes;

  return (
    <main className={styles.tela}>
      <h1>Gerente Financeiro</h1>
      <p className={styles.sub}>Plano ativo: {cenario.nome}</p>
      <section className={styles.cartoes}>
        <div className={styles.cartao}><span>Consignado quitado</span><strong>{data(ID_CONSIGNADO)}</strong></div>
        <div className={styles.cartao}><span>Chácara pronta</span><strong>{data('chacara')}</strong></div>
      </section>
      <p className={styles.sub}>As telas Início e Lançar vêm na etapa 3. Por enquanto, a projeção:</p>
      <div className={styles.rolagem}>
        <table className={styles.tabela}>
          <thead><tr><th>Mês</th><th>Renda</th><th>Saídas + variável</th><th>Guardar</th><th>Folga</th></tr></thead>
          <tbody>
            {projecao.meses.filter(m => m.mes <= ultimo).map(m => (
              <tr key={m.mes} className={m.avisos.length ? styles.aviso : undefined} title={m.avisos.join('\n')}>
                <td>{formatarMes(m.mes)}</td>
                <td>{formatarReais(m.rendaCentavos)}</td>
                <td>{formatarReais(m.saidasCentavos + m.variavelCentavos)}</td>
                <td>{formatarReais(m.metaCentavos)}</td>
                <td>{formatarReais(m.folgaCentavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
