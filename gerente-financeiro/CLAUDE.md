# Gerente Financeiro — app pessoal

App de finanças pessoais, para uso **de uma pessoa só**, no **celular**.
Todo o texto da interface é em **português do Brasil**, com valores em R$ (formato `R$ 1.234,56`) e datas `dd/mm/aaaa`.

## Leia antes de programar
- `docs/PLANO.md` — as regras financeiras. É a fonte da verdade do negócio.
- `docs/SPEC.md` — telas, modelo de dados, cálculos e importação de faturas.
- `data/dados-iniciais.json` — a situação real em 27/10/2026, carregada na primeira abertura.

## Stack
- Vite + React + TypeScript (strict)
- PWA instalável: `vite-plugin-pwa`, funcionando offline
- Dados **só no aparelho**: IndexedDB via Dexie. Sem servidor, sem login, sem enviar dado nenhum para fora
- Backup: exportar e importar um arquivo `.json` com tudo
- Gráficos: Recharts
- Importação de fatura: `pdfjs-dist` (PDF) e parser próprio (CSV)
- Testes: Vitest. Os cálculos financeiros (`src/domain/`) precisam ter testes
- Estilo: CSS Modules ou Tailwind; interface mobile-first, botões grandes, modo escuro automático

## Arquitetura
- `src/domain/` — funções puras: ciclos de fatura, parcelas, consignado, projeção mensal, simulador. **Sem React aqui.**
- `src/db/` — esquema Dexie, seed a partir de `data/dados-iniciais.json`, migrações, backup.
- `src/import/` — parsers de fatura (um por banco) + tela de revisão.
- `src/ui/` — telas e componentes.

## Regra mais importante
**O plano é customizável.** O PLANO.md define só os **valores padrão** do primeiro cenário. Nenhum valor do plano (meta, alvos, ordem das prioridades, extras, datas) pode ficar fixo no código: tudo vem de `ParametrosPlano`, é editável na tela e a projeção se recalcula na hora.

## Regras de código
- Dinheiro sempre em **centavos (inteiros)**. Nunca use float para somar dinheiro.
- Datas como `YYYY-MM-DD` (string) ou `YYYY-MM` para competência de fatura/mês.
- Toda regra do `PLANO.md` vira função testável em `src/domain/`.
- Nada de dados pessoais reais nos testes nem em arquivos versionados além do seed. Faturas reais para teste ficam em `fixtures/` (no `.gitignore`).

## Publicação
Para instalar no celular, o app precisa de HTTPS. Publicar o build estático no GitHub Pages, Netlify ou Vercel (grátis). Só o código vai para lá. Os dados continuam no celular.

## Privacidade (repositório público)
`data/dados-iniciais.json` e `docs/PLANO.md` têm dados reais e estão no `.gitignore`. Ficam só no computador.
- O app só embute o seed em desenvolvimento (`npm run dev`). No build de produção, a primeira abertura pede o arquivo `.json`.
- Testes que conferem números reais leem `data/dados-iniciais.json` e são pulados quando ele não existe.
