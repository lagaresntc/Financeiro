import { Topo } from '../componentes';
import { href } from '../rotas';

const ITENS: [string, string, string][] = [
  ['📥', 'Importar fatura', 'importar'],
  ['🎯', 'Cenários do plano', 'plano/cenarios'],
  ['✏️', 'Editor do plano', 'plano/editor'],
  ['💳', 'Cartões e faturas', 'cartoes'],
  ['⚙️', 'Ajustes e backup', 'ajustes'],
];

export default function Mais() {
  return (
    <main className="tela">
      <Topo titulo="Mais" />
      <section className="cartao">
        <div className="lista">
          {ITENS.map(([icone, nome, rota]) => (
            <a key={rota} href={href(...rota.split('/'))} className="linha" style={{ textDecoration: 'none', color: 'inherit', minHeight: 48 }}>
              <span><span aria-hidden>{icone}</span> {nome}</span><span className="fraco">›</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
