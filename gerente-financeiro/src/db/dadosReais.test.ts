// Confere os cálculos contra os números do PLANO.md usando o arquivo real.
// O arquivo não vai para o Git: sem ele, estes testes são pulados.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DadosIniciais } from './mapearSeed';
import { cenarioAtivoId, parametrosDoCenario, situacaoDoSeed } from './mapearSeed';
import { competenciaDaCompra, datasDaFatura } from '../domain/faturas';
import { custoParcela, saldoParaQuitar } from '../domain/consignado';
import { projetar, ID_CONSIGNADO } from '../domain/projecao';
import { quantoGuardar } from '../domain/quantoGuardar';

const arquivo = resolve(__dirname, '../../data/dados-iniciais.json');
const temArquivo = existsSync(arquivo);
const dados = temArquivo ? (JSON.parse(readFileSync(arquivo, 'utf8')) as DadosIniciais) : null;

describe.skipIf(!temArquivo)('números do PLANO.md (dados reais)', () => {
  const situacao = situacaoDoSeed(dados!);
  const params = parametrosDoCenario(dados!, cenarioAtivoId(dados!));
  const cartao = (id: string) => situacao.cartoes.find(c => c.id === id)!;

  it('compra no Croma em 08/11/2026 cai na fatura que vence 12/12/2026', () => {
    const comp = competenciaDaCompra(cartao('croma'), '2026-11-08');
    expect(comp).toBe('2026-12');
    expect(datasDaFatura(cartao('croma'), comp).vencimento).toBe('2026-12-12');
  });

  it('compra no BB em 31/10/2026 cai na fatura que vence 12/12/2026', () => {
    const comp = competenciaDaCompra(cartao('bb'), '2026-10-31');
    expect(comp).toBe('2026-12');
    expect(datasDaFatura(cartao('bb'), comp).vencimento).toBe('2026-12-12');
  });

  it('consignado em nov/2026: parcela 95 cheia ≈ R$ 114,12, parcial ≈ R$ 95, quitar tudo ≈ R$ 29.321', () => {
    const cfg = situacao.consignadoCfg;
    expect(custoParcela(cfg, 95, '2026-11')).toBe(11412);
    expect(Math.abs(custoParcela(cfg, 95, '2026-11', situacao.consignado.nominalMaiorCentavos) - 9500)).toBeLessThan(100);
    expect(Math.abs(saldoParaQuitar(cfg, situacao.consignado, '2026-11') - dados!.consignado.saldoEstimadoQuitacaoNov26Centavos!)).toBeLessThan(100);
  });

  it('projeção: consignado ~mai/2027 e chácara ~dez/2027', () => {
    const proj = projetar(situacao, params, { horizonteMeses: 36 });
    expect(proj.datas[ID_CONSIGNADO]).toBe('2027-05');
    expect(proj.datas.chacara).toBe('2027-12');
  });

  it('chácara em nov/2027 tem uma meta mensal possível', () => {
    const r = quantoGuardar(situacao, params, 'chacara', '2027-11');
    expect(r.possivel).toBe(true);
  });
});

