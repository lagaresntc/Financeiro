import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { seedJaAplicado } from '../db/seed';
import { importarArquivo } from '../db/backup';
import { comecarDoZero } from '../db/novo';
import { hojeLocal } from '../domain/datas';
import type { DadosIniciais } from '../db/mapearSeed';
import { ProvedorDados } from './dados';
import { href, useRota } from './rotas';
import { Toast } from './componentes';
import Inicio from './telas/Inicio';
import Lancar from './telas/Lancar';
import Cartoes from './telas/Cartoes';
import Plano from './telas/Plano';
import EditorPlano from './telas/EditorPlano';
import Cenarios from './telas/Cenarios';
import Simular from './telas/Simular';
import Importar from './telas/Importar';
import Ajustes from './telas/Ajustes';
import Mais from './telas/Mais';

// Em desenvolvimento, oferece carregar o arquivo local. No build de produção ele nunca é embutido.
const seedsDev = import.meta.env.DEV
  ? import.meta.glob<DadosIniciais>('../../data/dados-iniciais.json', { import: 'default' })
  : {};

type Estado = 'carregando' | 'primeira-abertura' | 'pronto';

export default function App() {
  const [estado, setEstado] = useState<Estado>('carregando');
  useEffect(() => {
    seedJaAplicado(db).then(ok => setEstado(ok ? 'pronto' : 'primeira-abertura'));
  }, []);

  if (estado === 'carregando') return <Carregando />;
  if (estado === 'primeira-abertura') return <PrimeiraAbertura aoTerminar={() => setEstado('pronto')} />;
  return (
    <ProvedorDados carregando={<Carregando />}>
      <Telas />
      <Toast />
    </ProvedorDados>
  );
}

function Carregando() {
  return <main className="tela"><p className="fraco">Carregando…</p></main>;
}

function Telas() {
  const [tela, ...resto] = useRota();
  let conteudo;
  switch (tela) {
    case 'lancar': conteudo = <Lancar />; break;
    case 'cartoes': conteudo = <Cartoes rota={resto} />; break;
    case 'plano':
      conteudo = resto[0] === 'editor' ? <EditorPlano /> : resto[0] === 'cenarios' ? <Cenarios /> : <Plano />;
      break;
    case 'simular': conteudo = <Simular />; break;
    case 'importar': conteudo = <Importar />; break;
    case 'ajustes': conteudo = <Ajustes rota={resto} />; break;
    case 'mais': conteudo = <Mais />; break;
    default: conteudo = <Inicio />;
  }
  const abaAtiva = ['importar', 'ajustes'].includes(tela ?? '') ? 'mais' : tela === 'lancar' ? 'inicio' : tela;
  return (
    <>
      {conteudo}
      {tela !== 'lancar' && <a className="fab" href={href('lancar')}>+ Lançar</a>}
      <nav className="nav" aria-label="Navegação principal">
        {[
          ['inicio', '🏠', 'Início'],
          ['cartoes', '💳', 'Cartões'],
          ['plano', '🎯', 'Plano'],
          ['simular', '🧮', 'Simular'],
          ['mais', '☰', 'Mais'],
        ].map(([id, icone, nome]) => (
          <a key={id} href={href(id!)} className={abaAtiva === id ? 'ativo' : undefined}>
            <span className="icone" aria-hidden>{icone}</span>{nome}
          </a>
        ))}
      </nav>
    </>
  );
}

function PrimeiraAbertura({ aoTerminar }: { aoTerminar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const carregarDev = Object.values(seedsDev)[0];

  async function executar(acao: () => Promise<unknown>) {
    try {
      setErro(null);
      await acao();
      aoTerminar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="tela">
      <h1>Gerente Financeiro</h1>
      <p className="fraco">Quanto você ainda pode gastar até o próximo salário, sem atrasar o plano. Tudo fica só neste aparelho.</p>
      <div className="cartao coluna">
        <h2>Como quer começar?</h2>
        <button className="botao cheio" onClick={() => executar(() => comecarDoZero(db, hojeLocal()))}>Começar do zero</button>
        <label className="botao secundario cheio">
          Abrir backup ou arquivo de dados (.json)
          <input
            type="file" accept="application/json,.json" hidden
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) executar(async () => importarArquivo(db, JSON.parse(await f.text())));
            }}
          />
        </label>
        {carregarDev && (
          <button className="botao secundario cheio" onClick={() => executar(async () => importarArquivo(db, await carregarDev()))}>
            Carregar data/dados-iniciais.json (só em desenvolvimento)
          </button>
        )}
        {erro && <p className="vermelho pequeno">{erro}</p>}
      </div>
    </main>
  );
}
