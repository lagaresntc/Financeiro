import { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, generateId } from '../../utils/finance';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, Plus, Edit2, Trash2, X, Landmark, BarChart2, Bitcoin, PiggyBank, HelpCircle, LucideIcon } from 'lucide-react';
import { Investment } from '../../types';

const TYPE_LABELS: Record<Investment['type'], string> = {
  savings: 'Poupança',
  cdb: 'CDB / Renda Fixa',
  stocks: 'Ações / FIIs',
  crypto: 'Criptomoedas',
  other: 'Outros',
};

const TYPE_ICONS: Record<Investment['type'], LucideIcon> = {
  savings: PiggyBank,
  cdb: Landmark,
  stocks: BarChart2,
  crypto: Bitcoin,
  other: HelpCircle,
};

const TYPE_COLORS: Record<Investment['type'], string> = {
  savings: '#10b981',
  cdb: '#6366f1',
  stocks: '#f59e0b',
  crypto: '#f97316',
  other: '#94a3b8',
};

interface InvestmentFormProps {
  initial?: Investment;
  onClose: () => void;
  onSave: (inv: Investment) => void;
}

function InvestmentForm({ initial, onClose, onSave }: InvestmentFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<Investment['type']>(initial?.type ?? 'savings');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [yieldPct, setYieldPct] = useState(initial?.yieldPercent?.toString() ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome obrigatório';
    if (!amount || isNaN(Number(amount)) || Number(amount) < 0) errs.amount = 'Valor inválido';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const inv: Investment = {
      id: initial?.id ?? generateId(),
      name: name.trim(),
      type,
      amount: Number(amount),
      yieldPercent: yieldPct ? Number(yieldPct) : undefined,
      updatedAt: new Date().toISOString(),
    };
    onSave(inv);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#12122a] border border-purple-800/40 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-purple-900/30">
          <h2 className="text-white font-semibold text-lg">{initial ? 'Editar Investimento' : 'Novo Investimento'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Nome</label>
            <input
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
              placeholder="Ex: Nubank CDB 100% CDI"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-2">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_LABELS) as Investment['type'][]).map(t => {
                const Icon = TYPE_ICONS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-medium transition-all ${
                      type === t
                        ? 'border-purple-500 bg-purple-900/30 text-white'
                        : 'border-purple-900/30 text-slate-500 hover:border-purple-700 hover:text-slate-300'
                    }`}
                  >
                    <Icon size={16} />
                    {TYPE_LABELS[t].split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Valor Atual (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
              placeholder="1000.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount}</p>}
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Rendimento Anual (% a.a.) — opcional</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
              placeholder="13.5"
              value={yieldPct}
              onChange={e => setYieldPct(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-purple-800/40 text-slate-400 text-sm hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Investments() {
  const { investments, setInvestments } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Investment | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalAmount = useMemo(() => investments.reduce((s, i) => s + i.amount, 0), [investments]);

  const byType = useMemo(() => {
    const map: Partial<Record<Investment['type'], number>> = {};
    for (const inv of investments) {
      map[inv.type] = (map[inv.type] ?? 0) + inv.amount;
    }
    return map;
  }, [investments]);

  function handleSave(inv: Investment) {
    if (editing) {
      setInvestments(prev => prev.map(i => i.id === inv.id ? inv : i));
    } else {
      setInvestments(prev => [...prev, inv]);
    }
    setShowForm(false);
    setEditing(undefined);
  }

  function handleDelete(id: string) {
    setInvestments(prev => prev.filter(i => i.id !== id));
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-2xl font-bold">Investimentos</h2>
          <p className="text-slate-500 text-sm mt-1">Acompanhe sua carteira de investimentos</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={16} />
          Novo
        </button>
      </div>

      {/* Summary */}
      <div className="bg-[#12122a] rounded-2xl p-5 border border-purple-900/30">
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-400 text-sm">Patrimônio Total</p>
          <TrendingUp size={18} className="text-purple-400" />
        </div>
        <p className="text-white text-3xl font-bold">{formatCurrency(totalAmount)}</p>
        {investments.length > 0 && (
          <div className="mt-4 space-y-2">
            {(Object.entries(byType) as [Investment['type'], number][]).map(([t, val]) => {
              const pct = totalAmount > 0 ? (val / totalAmount) * 100 : 0;
              return (
                <div key={t}>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{TYPE_LABELS[t]}</span>
                    <span>{formatCurrency(val)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-1.5 bg-[#0f0f1a] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: TYPE_COLORS[t] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {investments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <TrendingUp size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-medium text-slate-500">Nenhum investimento cadastrado</p>
          <p className="text-sm mt-1">Adicione suas aplicações para monitorar seu patrimônio</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={16} />
            Adicionar Investimento
          </button>
        </div>
      ) : (
        <div className="bg-[#12122a] rounded-2xl border border-purple-900/30 overflow-hidden">
          <div className="divide-y divide-purple-900/20">
            {investments.map(inv => {
              const Icon = TYPE_ICONS[inv.type];
              const color = TYPE_COLORS[inv.type];
              const pct = totalAmount > 0 ? (inv.amount / totalAmount) * 100 : 0;
              const monthlyYield = inv.yieldPercent ? inv.amount * (inv.yieldPercent / 100 / 12) : null;
              return (
                <div key={inv.id} className="p-4 sm:p-5 hover:bg-purple-900/5 transition-colors">
                  <div className="flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: color + '20' }}
                      >
                        <span style={{ color }}>
                          <Icon size={18} />
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate">{inv.name}</p>
                        <p className="text-slate-500 text-xs">{TYPE_LABELS[inv.type]}</p>
                        {inv.yieldPercent && (
                          <p className="text-emerald-400 text-xs mt-0.5">
                            {inv.yieldPercent}% a.a.
                            {monthlyYield !== null && ` · ${formatCurrency(monthlyYield)}/mês`}
                          </p>
                        )}
                        <p className="text-slate-600 text-xs mt-0.5">
                          Atualizado: {format(parseISO(inv.updatedAt), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right mr-2">
                        <p className="text-white font-bold text-sm">{formatCurrency(inv.amount)}</p>
                        <p className="text-slate-600 text-xs">{pct.toFixed(1)}% da carteira</p>
                      </div>
                      <button
                        onClick={() => { setEditing(inv); setShowForm(true); }}
                        className="p-1.5 text-slate-500 hover:text-purple-400 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(inv.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <InvestmentForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSave={handleSave}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#12122a] border border-purple-800/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-white text-sm mb-5">Excluir este investimento?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-purple-800/40 text-slate-400 text-sm hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
