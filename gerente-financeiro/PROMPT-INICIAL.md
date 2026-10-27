# Como começar no Claude Code

1. Descompacte esta pasta no seu computador (ex.: `Documentos/gerente-financeiro-app`).
2. Abra a pasta no Claude Code.
3. Cole a mensagem abaixo como primeira mensagem.

---

Leia o CLAUDE.md, o docs/PLANO.md, o docs/SPEC.md e o data/dados-iniciais.json.

Quero construir o app descrito ali, seguindo a "Ordem de construção" do SPEC.md. Comece pelas etapas 1 e 2:

1. Crie o projeto (Vite + React + TypeScript + PWA + Dexie) e o seed que carrega o dados-iniciais.json na primeira abertura.
2. Implemente o src/domain/ com testes: em qual fatura cai cada compra, 5º dia útil, consignado (antecipação de trás pra frente) e projeção mensal.

Antes de seguir para as telas, me mostre:
- em qual fatura cai uma compra feita no Croma em 08/11/2026 e uma feita no BB em 31/10/2026;
- o custo estimado para antecipar a parcela 95 em nov/2026 (cheia daria ~R$ 114; como ela está parcial em R$ 603,07, deve dar ~R$ 95) e o saldo para quitar tudo (~R$ 29,3 mil);
- a projeção de nov/2026 a dez/2027, com a data prevista para quitar o consignado e para a chácara.

Se algum número não bater com o PLANO.md, me pergunte antes de seguir.

Importante: o plano tem que ser customizável (veja "Editor do plano" no SPEC.md). Os números do PLANO.md são só o cenário inicial. Monte a projeção como uma função pura que recebe os parâmetros, para eu poder mudar a meta, os alvos e as prioridades e ver as datas se refazerem. Mostre também: "quanto preciso guardar por mês para a chácara ficar pronta em nov/2027?".

---

## Depois

- **Faturas de teste:** crie uma pasta `fixtures/` (fica fora do Git) e coloque os PDFs e CSVs reais das suas faturas para o Claude Code testar a importação.
- **Instalar no celular:** quando estiver pronto, peça "publique no GitHub Pages e me explique como instalar no celular".
- **Atualizar a situação:** o seed só roda na primeira abertura. Depois, o que vale é o que você lança no app.
