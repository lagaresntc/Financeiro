import { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, generateId } from '../../utils/finance';
import { DollarSign, Plus, Edit2, Trash2, X, Calendar } from 'lucide-react';
import { FixedIncome as FixedIncomeType } from '../../types';

interface IncomeFormProps {
  initial?: FixedIncomeType;
  onClose: () => void;
  onSave: (income: FixedIncomeType) => void;
}

function IncomeForm({ initial, onClose, onSave }: IncomeFormProps) {
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [dayOfMonth, setDayOfMonth] = useState(initial?.dayOfMonth?.toString() ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!description.trim()) errs.description = 'Descrição obrigatória';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) errs.amount = 'Valor inválido';
    const d = Number(dayOfMonth);
    if (!dayOfMonth || isNaN(d) || d < 1 || d > 31) errs.dayOfMonth = 'Dia inválido (1–31)';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave({
      id: initial?.id ?? generateId(),
      description: description.trim(),
      amount: Number(amount),
      dayOfMonth: Number(dayOfMonth),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#12122a] border border-purple-800/40 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-purple-900/30">
          <h2 className="text-white font-semibold text-lg">{initial ? 'Editar Receita' : 'Nova Receita Fixa'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Descrição</label>
            <input
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
              placeholder="Ex: Salário, Aluguel recebido..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">Valor Mensal (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
              placeholder="3500.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount}</p>}
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">Dia do Recebimento</label>
            <input
              type="number"
              min="1"
              max="31"
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
              placeholder="5"
              value={dayOfMonth}
              onChange={e => setDayOfMonth(e.target.value)}
            />
            {errors.dayOfMonth && <p className="text-red-400 text-xs mt-1">{errors.dayOfMonth}</p>}
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

export default function FixedIncome() {
  const { fixedIncomes, setFixedIncomes } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FixedIncomeType | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalMonthly = useMemo(() => fixedIncomes.reduce((s, i) => s + i.amount, 0), [fixedIncomes]);
  const totalAnnual = totalMonthly * 12;

  const sorted = useMemo(
    () => [...fixedIncomes].sort((a, b) => a.dayOfMonth - b.dayOfMonth),
    [fixedIncomes]
  );

  function handleSave(income: FixedIncomeType) {
    if (editing) {
      setFixedIncomes(prev => prev.map(i => i.id === income.id ? income : i));
    } else {
      setFixedIncomes(prev => [...prev, income]);
    }
    setShowForm(false);
    setEditing(undefined);
  }

  function handleDelete(id: string) {
    setFixedIncomes(prev => prev.filter(i => i.id !== id));
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-2xl font-bold">Receitas Fixas</h2>
          <p className="text-slate-500 text-sm mt-1">Registre suas fontes de renda mensais</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={16} />
          Nova Receita
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#12122a] rounded-2xl p-5 border border-purple-900/30">
          <p className="text-slate-400 text-xs mb-2">Total Mensal</p>
          <p className="text-emerald-400 text-2xl font-bold">{formatCurrency(totalMonthly)}</p>
        </div>
        <div className="bg-[#12122a] rounded-2xl p-5 border border-purple-900/30">
          <p className="text-slate-400 text-xs mb-2">Total Anual</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(totalAnnual)}</p>
        </div>
        <div className="bg-[#12122a] rounded-2xl p-5 border border-purple-900/30">
          <p className="text-slate-400 text-xs mb-2">Fontes de Renda</p>
          <p className="text-white text-2xl font-bold">{fixedIncomes.length}</p>
        </div>
      </div>

      {fixedIncomes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <DollarSign size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-medium text-slate-500">Nenhuma receita cadastrada</p>
          <p className="text-sm mt-1">Cadastre salário, aluguéis e outras rendas fixas</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={16} />
            Adicionar Receita
          </button>
        </div>
      ) : (
        <div className="bg-[#12122a] rounded-2xl border border-purple-900/30 overflow-hidden">
          <div className="divide-y divide-purple-900/20">
            {sorted.map(income => {
              const pct = totalMonthly > 0 ? (income.amount / totalMonthly) * 100 : 0;
              return (
                <div key={income.id} className="p-4 sm:p-5 hover:bg-purple-900/5 transition-colors">
                  <div className="flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                        <DollarSign size={18} className="text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{income.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar size={11} className="text-slate-600" />
                          <p className="text-slate-500 text-xs">Recebido todo dia {income.dayOfMonth}</p>
                        </div>
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span>{pct.toFixed(1)}% da renda</span>
                          </div>
                          <div className="h-1.5 bg-[#0f0f1a] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <div className="text-right mr-2">
                        <p className="text-emerald-400 font-bold text-sm">{formatCurrency(income.amount)}</p>
                        <p className="text-slate-600 text-xs">{formatCurrency(income.amount * 12)}/ano</p>
                      </div>
                      <button
                        onClick={() => { setEditing(income); setShowForm(true); }}
                        className="p-1.5 text-slate-500 hover:text-purple-400 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(income.id)}
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

          {/* Total row */}
          <div className="p-4 sm:px-5 bg-purple-900/10 border-t border-purple-900/30 flex justify-between items-center">
            <span className="text-slate-400 text-sm font-medium">Total Mensal</span>
            <span className="text-emerald-400 text-lg font-bold">{formatCurrency(totalMonthly)}</span>
          </div>
        </div>
      )}

      {showForm && (
        <IncomeForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSave={handleSave}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#12122a] border border-purple-800/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-white text-sm mb-5">Excluir esta receita fixa?</p>
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
