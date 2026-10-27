// Relatório de conferência dos cálculos contra o PLANO.md.
// Uso: npm run relatorio   (precisa de data/dados-iniciais.json, que não vai para o Git)
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DadosIniciais } from '../src/db/mapearSeed';
import { cenarioAtivoId, parametrosDoCenario, situacaoDoSeed } from '../src/db/mapearSeed';
import { competenciaDaCompra, datasDaFatura } from '../src/domain/faturas';
import { custoParcela, saldoParaQuitar } from '../src/domain/consignado';
import { projetar, ID_CONSIGNADO } from '../src/domain/projecao';
import { quantoGuardar } from '../src/domain/quantoGuardar';
import { quintoDiaUtil } from '../src/domain/diasUteis';
import { formatarReais as R } from '../src/domain/dinheiro';
import { formatarData, formatarMes, somarMeses } from '../src/domain/datas';

const arquivo = resolve(import.meta.dirname, '../data/dados-iniciais.json');
if (!existsSync(arquivo)) {
  console.error('Coloque o arquivo data/dados-iniciais.json para rodar o relatório.');
  process.exit(1);
}
const dados = JSON.parse(readFileSync(arquivo, 'utf8')) as DadosIniciais;
const situacao = situacaoDoSeed(dados);
const params = parametrosDoCenario(dados, cenarioAtivoId(dados));
const cartao = (id: string) => situacao.cartoes.find(c => c.id === id)!;

console.log('\n== Em qual fatura cai ==');
for (const [id, data] of [['croma', '2026-11-08'], ['bb', '2026-10-31']] as const) {
  const comp = competenciaDaCompra(cartao(id), data);
  const { fechamento, vencimento } = datasDaFatura(cartao(id), comp);
  console.log(`${id.toUpperCase()} em ${formatarData(data)} → fatura ${formatarMes(comp)} (fecha ${formatarData(fechamento)}, vence ${formatarData(vencimento)})`);
}

console.log('\n== 5º dia útil ==');
for (let i = 0; i < 6; i++) {
  const mes = somarMeses('2026-11', i);
  console.log(`${formatarMes(mes)}: ${formatarData(quintoDiaUtil(Number(mes.slice(0, 4)), Number(mes.slice(5))))}`);
}

console.log('\n== Consignado em nov/2026 ==');
const cfg = situacao.consignadoCfg;
console.log(`Parcela 95 cheia: ${R(custoParcela(cfg, 95, '2026-11'))}`);
console.log(`Parcela 95 parcial (${R(situacao.consignado.nominalMaiorCentavos)} nominais): ${R(custoParcela(cfg, 95, '2026-11', situacao.consignado.nominalMaiorCentavos))}`);
console.log(`Saldo para quitar tudo: ${R(saldoParaQuitar(cfg, situacao.consignado, '2026-11'))}  (parcelas ${situacao.consignado.menorAberta} a ${situacao.consignado.maiorAberta})`);

const proj = projetar(situacao, params, { horizonteMeses: 26 });
console.log('\n== Projeção (cenário ativo) ==');
console.log('mês       renda       saídas      variável    meta        folga       → reserva   → consig.   → chácara   saldo consig.  chácara');
for (const m of proj.meses.filter(m => m.mes <= '2027-12')) {
  const c = (n: number | undefined) => R(n ?? 0).padStart(11);
  console.log(
    `${formatarMes(m.mes).padEnd(9)} ${c(m.rendaCentavos)} ${c(m.saidasCentavos)} ${c(m.variavelCentavos)} ${c(m.metaCentavos)} ${c(m.folgaCentavos)} ${c(m.aportes.reserva)} ${c(m.aportes[ID_CONSIGNADO])} ${c(m.aportes.chacara)} ${c(m.saldos[ID_CONSIGNADO]).padStart(14)} ${c(m.saldos.chacara)}`,
  );
  for (const a of m.avisos) console.log(`          ⚠ ${a}`);
}
console.log(`\nConsignado quitado em: ${proj.datas[ID_CONSIGNADO] ? formatarMes(proj.datas[ID_CONSIGNADO]) : '—'}`);
console.log(`Reserva completa em:   ${proj.datas.reserva ? formatarMes(proj.datas.reserva) : '—'}`);
console.log(`Chácara pronta em:     ${proj.datas.chacara ? formatarMes(proj.datas.chacara) : 'depois de 2028'}`);
console.log(`Juros futuros do consignado: ${R(proj.jurosConsignadoCentavos)} (total pago ${R(proj.totalPagoConsignadoCentavos)})`);

console.log('\n== Quanto guardar para a chácara em nov/2027 ==');
const q = quantoGuardar(situacao, params, 'chacara', '2027-11');
if (q.possivel) console.log(`Meta mensal: ${R(q.metaMensalCentavos)} (pronta em ${formatarMes(q.mesPronto)}); exceções de nov, dez e jan mantidas.`);
else console.log(`Impossível. Melhor data: ${q.melhorMes ? formatarMes(q.melhorMes) : '—'}; meses travados: ${q.mesesTravados.map(formatarMes).join(', ')}`);

for (const id of dados.cenarios.map(c => c.id)) {
  const p = projetar(situacao, parametrosDoCenario(dados, id), { horizonteMeses: 60 });
  console.log(`Cenário ${id}: consignado ${p.datas[ID_CONSIGNADO] ? formatarMes(p.datas[ID_CONSIGNADO]) : '—'}, chácara ${p.datas.chacara ? formatarMes(p.datas.chacara) : '—'}, juros ${R(p.jurosConsignadoCentavos)}`);
}
