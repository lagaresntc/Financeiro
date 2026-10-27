import type { BancoFinanceiro } from './schema';
import { TABELAS } from './schema';
import { aplicarSeed } from './seed';
import type { DadosIniciais } from './mapearSeed';

export interface Backup {
  _app: 'gerente-financeiro';
  versao: 1;
  exportadoEm: string;
  tabelas: Record<string, unknown[]>;
}

export async function exportarBackup(db: BancoFinanceiro, agora = new Date()): Promise<Backup> {
  const tabelas: Record<string, unknown[]> = {};
  for (const t of TABELAS) tabelas[t] = await db.table(t).toArray();
  return { _app: 'gerente-financeiro', versao: 1, exportadoEm: agora.toISOString(), tabelas };
}

export async function apagarTudo(db: BancoFinanceiro): Promise<void> {
  await db.transaction('rw', TABELAS.map(t => db.table(t)), async () => {
    for (const t of TABELAS) await db.table(t).clear();
  });
}

function ehBackup(x: unknown): x is Backup {
  return typeof x === 'object' && x !== null && (x as Backup)._app === 'gerente-financeiro';
}

function ehDadosIniciais(x: unknown): x is DadosIniciais {
  return typeof x === 'object' && x !== null && 'cenarios' in x && 'cartoes' in x && 'dataReferencia' in x;
}

/**
 * Restaura um backup (substitui tudo) ou carrega um arquivo de dados iniciais.
 * Devolve o tipo de arquivo reconhecido.
 */
export async function importarArquivo(db: BancoFinanceiro, conteudo: unknown): Promise<'backup' | 'dados-iniciais'> {
  if (ehBackup(conteudo)) {
    await db.transaction('rw', TABELAS.map(t => db.table(t)), async () => {
      for (const t of TABELAS) {
        await db.table(t).clear();
        const linhas = conteudo.tabelas[t];
        if (linhas?.length) await db.table(t).bulkAdd(linhas);
      }
    });
    return 'backup';
  }
  if (ehDadosIniciais(conteudo)) {
    await apagarTudo(db);
    await aplicarSeed(db, conteudo);
    return 'dados-iniciais';
  }
  throw new Error('Arquivo não reconhecido: não é um backup deste app nem um dados-iniciais.json.');
}
