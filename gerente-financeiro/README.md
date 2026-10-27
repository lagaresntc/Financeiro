# Gerente Financeiro

App de celular (PWA) que responde: **quanto ainda posso gastar até o próximo salário, sem atrasar o plano?**
Tudo fica só no aparelho (IndexedDB). Sem servidor, sem login.

## Rodar

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm test           # testes (Vitest)
npm run build      # build de produção em dist/ (PWA, funciona offline)
npm run relatorio  # confere os cálculos contra o PLANO.md (precisa de data/dados-iniciais.json)
```

Na primeira abertura dá para **começar do zero** ou abrir um arquivo `.json` (backup do app ou `dados-iniciais.json`).

## Telas

| Tela | O que faz |
|---|---|
| **Início** | "Pode gastar até o salário" + R$/dia, alertas, faturas abertas, metas e próximos eventos |
| **Lançar** (+ Lançar) | Valor, forma, categoria, parcelas. Diz em qual fatura caiu e avisa: Pix no crédito, parcelado longo, estouro da folga |
| **Cartões** | Faturas abertas, fechadas e futuras; detalhe; marcar como paga; conferir com o saldo do app do banco |
| **Plano** | Datas previstas, real × plano, checklist do mês, consignado (simular e registrar antecipação), projeção com gráfico |
| **Editor do plano** | Tudo editável: meta mensal e exceções, extras (%), prioridades e alvos, metas novas, renda, contas fixas, orçamento, eventos, premissas. As datas se refazem a cada tecla. Inclui "meta por data" |
| **Cenários** | Ativar (com histórico), duplicar, renomear, comparar 2–3 lado a lado |
| **Simular** | Tabela mês a mês, veredito, atraso nas metas, melhor dia de compra, "Confirmar compra" |
| **Importar** | Nubank (CSV), Itaú (PDF) e genérico, com tela de revisão, duplicados desmarcados e categorias que o app aprende |
| **Ajustes** | Cartões (fechamento, vencimento, mudança de vencimento, mensalidade), saldos das metas, consignado, lembretes, investimentos, veículos, regras de categoria, backup e apagar tudo |

## Código

- `src/domain/` — regras puras e testadas: faturas, 5º dia útil, consignado, projeção, meta por data, ciclo/"pode gastar", simulador, alertas, categorias.
- `src/db/` — Dexie, carga da situação real a partir do banco, seed, começar do zero, backup.
- `src/import/` — parsers de fatura.
- `src/ui/` — telas (`telas/`), componentes e estilo (modo escuro automático).

Rendas, contas fixas, orçamento e eventos do plano ficam **dentro de cada cenário**, não em tabelas soltas: cenários diferentes podem ter rendas diferentes.

## Privacidade

`data/dados-iniciais.json` e `docs/PLANO.md` estão no `.gitignore`. O build de produção não embute nenhum dado.
