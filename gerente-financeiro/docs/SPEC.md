# Especificação do app

## 1. A pergunta que o app responde

**"Quanto eu ainda posso gastar até o próximo salário, sem atrasar o plano?"**

A tela inicial responde isso em um número grande. Todo o resto serve para manter esse número certo.

## 2. Telas

### 2.1 Início
- **Número grande:** "Pode gastar até o salário de dd/mm: R$ X". Esse valor é a folga do ciclo menos o que já foi lançado.
- Barra de progresso do ciclo e quanto dá por dia ("R$ Y/dia").
- **Faturas abertas**: um cartão por banco com o valor atual, a data de fechamento, o vencimento e um alerta quando faltam ≤ 3 dias para fechar.
- **Próximos eventos**: salário, abono, 13º, IPVA, vencimentos.
- **Metas**: progresso do consignado (parcelas restantes e saldo estimado) e do fundo da chácara.
- Botão flutuante **"+ Lançar"**.

### 2.2 Lançar gasto (em até 3 toques)
Campos: valor · forma (Croma / Itaú / BB / Pix / dinheiro) · categoria · parcelas (1x por padrão) · descrição (opcional) · data (hoje por padrão).
- Categorias: Mercado, Gasolina, Farmácia, Delivery/lanche, Compras online, Bebê, Viagem, Casa, Veículos, Estudos, Outros.
- Ao salvar, mostra em qual fatura a compra caiu ("Entra na fatura Croma de 12/12").
- **Alertas na hora:**
  - Pix no crédito: "Cobra IOF e encargos. Prefira Pix da conta."
  - Parcelamento acima de 4x: mostra o impacto nos meses seguintes.
  - Gasto que estoura a folga do ciclo: avisa quanto sai da meta.

### 2.3 Cartões
- Lista das faturas por cartão: abertas, fechadas e futuras (só parcelas).
- Detalhe da fatura: lançamentos, parcelas e total.
- Marcar uma fatura como paga.
- Configuração do cartão: dia de fechamento, dia de vencimento, limite.

### 2.4 Plano
- **Consignado:** parcelas pagas e restantes, saldo estimado para quitar e histórico de antecipações.
  - Botão **"Registrar antecipação"**: valor pago e quais parcelas foram quitadas (ex.: da 95 à 80). O usuário confere no app do BB.
  - Simulação: "Com R$ X hoje, você elimina as parcelas N a M (R$ Z nominais)".
- **Projeção mês a mês** até a chácara: renda, fixas, parcelas, meta, folga, destino do dinheiro e saldo das metas.
- **Datas previstas:** consignado quitado e chácara pronta, recalculadas a cada mudança.
- **Checklist do mês:** guardar a meta, pagar faturas, pagar contas por Pix. Marca e desmarca.

### 2.4.1 Editor do plano (o plano é customizável)

**Princípio:** nenhum número do plano fica fixo no código. Tudo o que está no PLANO.md vira parâmetro editável, e a projeção se refaz **na hora** a cada alteração, mostrando as novas datas.

**O que dá para alterar:**
- **Quanto guardar:** a meta mensal padrão e exceções por mês (ex.: jan/2027 = R$ 2.000; dez/2026 = só o 13º).
- **Extras:** para cada um (abono, 13º, licença, venda de veículo), uma chave "vai para o plano" (sim/não) ou a porcentagem que vai.
- **Prioridades:** a ordem dos destinos, arrastando (reserva → consignado → chácara → investimentos), e o alvo de cada meta (reserva R$ 3.000, chácara R$ 45.000).
- **Metas novas:** adicionar outras (carro, viagem, aposentadoria), com valor-alvo e prioridade.
- **Renda e gastos:** salários, início e fim de cada renda, contas fixas, o orçamento variável por categoria.
- **Eventos pontuais:** venda do Uno em dez por R$ 7.500, IPVA de R$ 900 em fev, uma compra grande. Cada um com data e valor.
- **Premissas:** CDI, rendimento da Caixinha, margem mínima.

**Modos de uso:**
1. **"E se...?" (para frente):** altero os números e vejo as datas. Ex.: "guardar R$ 3.000 em vez de R$ 4.000" mostra o consignado em jun/27 e a chácara em fev/28.
2. **Meta por data (para trás):** escolho a data e o app calcula quanto guardar. Ex.: "quero a chácara em nov/2027" mostra que é preciso guardar R$ X por mês a partir de fev/27.
3. **Comparar cenários:** salvar cenários com nome ("Plano atual", "Vendendo os veículos", "Modo apertado") e ver lado a lado: datas, total de juros pagos no consignado e o saldo de cada meta mês a mês.

**Plano ativo:**
- Um cenário é marcado como **ativo**. É ele que a tela Início, os alertas e o "pode gastar" usam.
- Trocar o cenário ativo pede confirmação e guarda o anterior (histórico).

**Real versus plano:**
- Todo mês, o app compara o que foi **planejado** com o que **aconteceu** (quanto foi guardado de fato, quanto foi gasto).
- Se o real ficar abaixo do plano, ele **recalcula as datas** a partir da situação real e avisa: "Você guardou R$ 2.500 em vez de R$ 4.000. Consignado agora previsto para jun/27."

### 2.5 Simular compra
Entradas: valor, número de parcelas, cartão, data da compra.
Saída:
- Tabela mês a mês: folga antes, parcela e folga depois.
- Veredito: "Cabe na folga" (verde) ou "Come R$ X da meta em N meses" (vermelho).
- Atraso estimado nas datas do consignado e da chácara.
- Sugestão: "Compre a partir de dd/mm (melhor dia do cartão X) para a 1ª parcela cair em <mês>".
- Opção "Confirmar compra", que transforma a simulação em lançamento.

### 2.6 Importar fatura
- Escolher o banco e o arquivo (PDF ou CSV).
- O parser extrai os lançamentos e mostra uma **tela de revisão**: data, descrição, valor, parcela X/Y e categoria sugerida (editável).
- Detecta duplicados (mesma data, valor e descrição parecida já lançada) e desmarca por padrão.
- Só salva depois que o usuário confirma.

### 2.7 Ajustes
Renda, contas fixas, metas, orçamento por categoria, cartões, veículos, exportar e importar backup, e apagar tudo.

## 3. Modelo de dados (Dexie)

```
cartoes        { id, nome, banco, diaFechamento, diaVencimento, limite?, principal: bool, cashbackPct? }
lancamentos    { id, data, valorCentavos, forma: cartaoId|'pix'|'dinheiro', categoria, descricao,
                 parcelas: n, parcelaInicial: k, grupoParcelaId?, origem: 'manual'|'importado', faturaRef? }
faturas        { id, cartaoId, competencia: 'YYYY-MM', fechamento, vencimento, status: 'aberta'|'fechada'|'paga',
                 saldoInformadoCentavos? }   // saldo que o usuário vê no app do banco, para conferência
rendas         { id, nome, valorCentavos, regra: 'mensal'|'meses'|'unica', dia: number|'5du', meses?: number[],
                 inicio?, fim? }
fixas          { id, nome, valorCentavos, dia?, forma, inicio?, fim? }
orcamento      { categoria, valorMensalCentavos }
consignado     { contrato, parcelaCentavos, totalParcelas, taxaMes, k: 749.84, base: 1.021138, mesBase: '2026-06',
                 parcelasPagasAte: 6, maiorParcelaAberta: 95, parcelaParcial?: {numero, valorCentavos} }
antecipacoes   { id, data, valorPagoCentavos, deParcela, ateParcela }
metas          { id, nome, alvoCentavos, saldoCentavos, ordem }
investimentos  { id, tipo, nome, valorCentavos, livreCentavos?, taxa?, quantidade?, precoMedio? }
veiculos       { id, nome, ano, fipeCentavos, plano: 'manter'|'vender', status, notas }
eventos        { id, data, titulo, valorCentavos?, tipo }   // IPVA, viagem, etc.
cenarios       { id, nome, ativo: bool, criadoEm, parametros: ParametrosPlano }
historicoPlano { id, data, cenarioId, resumo }        // quando o cenário ativo muda
fechamentoMes  { competencia, planejadoGuardarCentavos, guardadoRealCentavos, gastoRealCentavos }

ParametrosPlano {
  metaMensalCentavos, metaPorMes: { 'YYYY-MM': centavos | '13o' },
  extras: { abono: {pct}, decimoTerceiro: {pct}, licenca: {pct}, vendas: {pct} },
  destinos: [ { metaId, ordem, alvoCentavos?, ondeAplicar?: 'caixinha'|'lci'|'cdb' } ],
  rendas[], fixas[], orcamentoVariavel{}, eventos: [ { data, descricao, valorCentavos, tipo: 'entrada'|'saida' } ],
  premissas: { cdiAnual, caixinhaPctCdi, caixinhaLimiteCentavos, lciPctCdi, margemMinimaCentavos }
}
```

## 4. Cálculos (src/domain)

### 4.1 Em qual fatura cai uma compra
- Compra com data **anterior ou igual ao dia de fechamento** do mês → fatura que vence naquele mês (ou no seguinte, se o vencimento for menor que o fechamento, como no BB: fecha 30, vence 12 do mês seguinte).
- Compra **depois** do fechamento → próxima fatura.
- A parcela k de n cai na fatura (competência inicial + k − 1).
- Testes com os cartões reais: Itaú (fecha 3, vence 10), BB (fecha 30, vence 12), Croma (fecha 7, vence 14, que muda para 12 em dez/2026).

### 4.2 5º dia útil
Dias úteis de segunda a sexta, excluindo feriados nacionais e os de MG (tabela de feriados embutida, com Carnaval e Corpus Christi calculados pela Páscoa).

### 4.3 Consignado
- Custo para antecipar a parcela `t` no mês `m` (meses desde jun/2026):
  `custo(t, m) = 749,84 × 1,021138^m / 1,021138^t` (calibrado com o extrato real).
- A parcela 95 tem valor parcial (R$ 603,07): o custo é proporcional.
- **Antecipar com valor V no mês m:** quitar da maior parcela aberta para baixo enquanto couber; o resto abate parte da próxima.
- Todo mês, a folha paga a menor parcela aberta (dia 5).
- Quitado quando não sobrar parcela aberta. A partir do mês seguinte, +R$ 722,94 na renda.
- **O valor real é o do app do BB.** O app mostra a estimativa e permite registrar o valor real pago.
- Teste: em nov/2026, o custo da parcela 95 cheia ≈ R$ 114,12 e o saldo para quitar tudo ≈ R$ 29.321.

### 4.4 Projeção mensal
Para cada mês:
```
renda       = salário (+ abono nos meses dele, + 13º em dez) + esposa + aluguel + licença + liberadoConsignado
saídas      = fixas do mês + parcelas que caem nas faturas que vencem no mês
meta        = config (4.000; jan/2027 2.000; dez/2026 = 13º) + extras (abono, 4ª licença, vendas)
folga       = renda − saídas − meta − orçamento variável
se folga < margemMínima → reduz a meta até a margem (e avisa)
destino da meta: reserva até 3.000 → consignado → chácara (Caixinha até 10.000, depois LCI/LCA)
rendimento: Caixinha 120% do CDI; usar um CDI configurável (padrão 14,25% a.a.)
```

### 4.4.1 Projeção como função pura
- `projetar(situacaoAtual, parametros) → { meses[], datas: {metaId: 'YYYY-MM'}, jurosConsignadoCentavos }`.
- Rápida o bastante para recalcular a cada tecla (meta: < 50 ms para 60 meses).
- `situacaoAtual` = dados reais lançados até hoje (saldo das metas, parcelas abertas do consignado, faturas). Assim, o plano sempre recomeça do real.

### 4.4.2 Meta por data (cálculo reverso)
- `quantoGuardar(situacaoAtual, parametros, metaId, dataAlvo)`: busca binária na meta mensal até a meta ficar pronta na data-alvo.
- Se for impossível (a meta passaria a folga de algum mês), avisa qual mês trava e quanto falta.

### 4.5 "Pode gastar"
`podeGastar = renda do ciclo − fixas − faturas que vencem no ciclo − meta − gastos já lançados no ciclo − margem mínima`
O ciclo vai do salário até o próximo salário (5º dia útil).

### 4.6 Alertas automáticos
- Fechamento de cartão em ≤ 3 dias e quanto ainda cabe até lá.
- Croma: risco de pagar mensalidade (gasto do mês < R$ 4.000 **e** saldo guardado no Nubank < limite de isenção).
- Reserva abaixo de R$ 3.000: "Repor antes do consignado".
- Gasto por categoria acima do orçamento.
- IPVA em fevereiro (lembrete em janeiro).

## 5. Importação de faturas

Cada parser devolve `{ data, descricao, valorCentavos, parcela?: {k, n}, internacional?: bool }[]`.

### Itaú (PDF)
- O texto da fatura tem blocos "Lançamentos: compras e saques", "Lançamentos internacionais" e "Lançamentos: produtos e serviços".
- Linha típica: `DD/MM ESTABELECIMENTO[ NN/NN] VALOR`, com a categoria e a cidade na linha de baixo (ignorar).
- Valores negativos com "- " são estornos.
- Ignorar o bloco "Compras parceladas - próximas faturas" (são parcelas futuras; o app já as gera).
- O PDF tem duas colunas: extrair pela posição x do pdf.js.
- O ano vem do "Vencimento: DD/MM/AAAA" no topo.

### Nubank (CSV)
- O app do Nubank exporta CSV com as colunas `date,title,amount`.
- A parcela aparece no título ("Parcela 2/3").
- Pagamentos de fatura aparecem negativos: ignorar.

### Banco do Brasil (PDF)
- Implementar depois de ver um PDF real. Até lá, usar um parser genérico: linhas com data `DD/MM`, texto e valor `1.234,56`, sempre com a tela de revisão.

### Categorização automática
Regras por palavra-chave, editáveis: `SUPERMERCADO|MERCADO|COMERCIAL|PADARIA` → Mercado · `POSTO|AUTO POSTO` → Gasolina · `FARMACIA|DROGARIA` → Farmácia · `IFD|IFOOD|BURGUER|SUSHI|LANCHE` → Delivery/lanche · `SHOPEE|MERCADOLIVRE|AMAZON|TIKTOK` → Compras online · `PIX` → alerta "Pix no crédito".
O app aprende: quando o usuário corrige a categoria de uma descrição, guarda a regra.

## 6. Ordem de construção

1. Projeto Vite + PWA + Dexie + seed dos dados iniciais.
2. `src/domain/` com testes: ciclos de fatura, 5º dia útil, consignado e projeção. **Conferir os números contra o PLANO.md.**
3. Telas Início e Lançar.
4. Cartões e faturas.
5. Plano (consignado, projeção, metas) **+ editor do plano, cenários e meta por data**.
6. Simulador de compra.
7. Importação: Itaú PDF, Nubank CSV e genérico.
8. Backup, ajustes e alertas.
9. Publicar e instalar no celular.

## 7. Critérios de pronto
- Abre offline no celular, instalado como app.
- Lançar um gasto leva menos de 10 segundos.
- Os números da projeção batem com o PLANO.md (testes).
- Mudar a meta mensal no editor atualiza as datas na mesma hora, e "quero a chácara em nov/2027" devolve quanto guardar.
- O backup exportado e importado restaura tudo.
- Nenhum dado sai do aparelho.
