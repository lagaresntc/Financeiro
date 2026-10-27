import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { BancoFinanceiro, TABELAS } from './schema';
import { apagarTudo, exportarBackup, importarArquivo } from './backup';
import { comecarDoZero } from './novo';
import { seedJaAplicado } from './seed';

let db: BancoFinanceiro;
afterEach(async () => { await db.delete(); });

async function tudo(banco: BancoFinanceiro) {
  const r: Record<string, unknown[]> = {};
  for (const t of TABELAS) r[t] = await banco.table(t).toArray();
  return r;
}

describe('backup', () => {
  it('exportar e importar restaura tudo', async () => {
    db = new BancoFinanceiro(`teste-${Math.random()}`);
    await comecarDoZero(db, '2027-01-15');
    await db.cartoes.add({ id: 'roxo', nome: 'Roxo', diaFechamento: 5, diaVencimento: 12, principal: true });
    await db.lancamentos.add({ data: '2027-01-10', valorCentavos: 1234, forma: 'roxo', categoria: 'Mercado', descricao: 'Pão', parcelas: 1, parcelaInicial: 1, origem: 'manual' });
    const antes = await tudo(db);
    const arquivo = JSON.parse(JSON.stringify(await exportarBackup(db)));

    await apagarTudo(db);
    expect(await db.cartoes.count()).toBe(0);
    expect(await importarArquivo(db, arquivo)).toBe('backup');
    expect(await tudo(db)).toEqual(antes);
  });

  it('recusa arquivo desconhecido', async () => {
    db = new BancoFinanceiro(`teste-${Math.random()}`);
    await expect(importarArquivo(db, { qualquer: 1 })).rejects.toThrow('não reconhecido');
  });
});

describe('começar do zero', () => {
  it('cria um plano ativo vazio e marca a primeira abertura como feita', async () => {
    db = new BancoFinanceiro(`teste-${Math.random()}`);
    await comecarDoZero(db, '2027-01-15');
    expect(await seedJaAplicado(db)).toBe(true);
    const cenarios = await db.cenarios.toArray();
    expect(cenarios).toHaveLength(1);
    expect(cenarios[0]!.ativo).toBe(true);
    expect(cenarios[0]!.parametros.rendas).toEqual([]);
    expect((await db.metas.get('reserva'))!.saldoCentavos).toBe(0);
  });
});
