import { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, cardBillForMonth, generateId } from '../../utils/finance';
import { getMonth, getYear, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2, Circle, ChevronLeft, ChevronRight, Plus, Trash2, X,
  CreditCard, Receipt, ListChecks,
} from 'lucide-react';
import { BillItem } from '../../types';

interface Row {
  key: string;        // unique source id (card:xxx | item:xxx)
  name: string;
  amount: number;     // 0 = variável
  dueDay: number;
  kind: 'card' | 'manual';
  manualId?: string;
}

function monthKey(month: number, year: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function BillForm({ onClose, onSave }: { onClose: () => void; onSave: (item: BillItem) => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome obrigatório';
    if (amount && (isNaN(Number(amount)) || Number(amount) < 0)) errs.amount = 'Valor inválido';
    const d = Number(dueDay);
    if (dueDay && (isNaN(d) || d < 1 || d > 31)) errs.dueDay = 'Dia inválido (1–31)';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({
      id: generateId(),
      name: name.trim(),
      amount: amount ? Number(amount) : 0,
      dueDay: dueDay ? Number(dueDay) : 0,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#12122a] border border-purple-800/40 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-purple-900/30">
          <h2 className="text-white font-semibold text-lg">Nova Conta Recorrente</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Nome da conta</label>
            <input
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
              placeholder="Ex: Luz, Água, Internet, Aluguel..."
              value={name}
              onChange={e => setName(e.target.value)}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Valor (R$) <span className="text-slate-600">— opcional</span></label>
              <input
                type="number" min="0" step="0.01"
                className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
                placeholder="150.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Vencimento <span className="text-slate-600">— opcional</span></label>
              <input
                type="number" min="1" max="31"
                className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
                placeholder="10"
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
              />
              {errors.dueDay && <p className="text-red-400 text-xs mt-1">{errors.dueDay}</p>}
            </div>
          </div>
          <p className="text-slate-600 text-xs">
            Deixe o valor em branco para contas que variam todo mês (ex: conta de luz).
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-purple-800/40 text-slate-400 text-sm hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors">
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Checklist() {
  const { cards, purchases, billItems, setBillItems, paidKeys, setPaidKeys } = useFinance();
  const today = new Date();
  const [offset, setOffset] = useState(0); // 0 = mês atual, -1 anterior, +1 próximo

  const viewDate = new Date(getYear(today), getMonth(today) + offset, 1);
  const month = getMonth(viewDate);
  const year = getYear(viewDate);
  const mKey = monthKey(month, year);

  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const cardRows: Row[] = cards.map(c => {
      const bill = cardBillForMonth(c, purchases, month, year);
      return {
        key: `card:${c.id}`,
        name: `Fatura ${c.name}`,
        amount: bill,
        dueDay: c.dueDay,
        kind: 'card' as const,
      };
    }).filter(r => r.amount > 0);

    const manualRows: Row[] = billItems.map(b => ({
      key: `item:${b.id}`,
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay,
      kind: 'manual' as const,
      manualId: b.id,
    }));

    return [...cardRows, ...manualRows].sort((a, b) => {
      const da = a.dueDay || 99;
      const db = b.dueDay || 99;
      return da - db;
    });
  }, [cards, purchases, billItems, month, year]);

  const isPaid = (rowKey: string) => paidKeys.includes(`${rowKey}|${mKey}`);

  function togglePaid(rowKey: string) {
    const full = `${rowKey}|${mKey}`;
    setPaidKeys(prev => prev.includes(full) ? prev.filter(k => k !== full) : [...prev, full]);
  }

  function handleSaveItem(item: BillItem) {
    setBillItems(prev => [...prev, item]);
    setShowForm(false);
  }

  function handleDeleteItem(id: string) {
    setBillItems(prev => prev.filter(i => i.id !== id));
    // limpa marcações de pagamento deste item em todos os meses
    setPaidKeys(prev => prev.filter(k => !k.startsWith(`item:${id}|`)));
    setDeleteId(null);
  }

  const paidCount = rows.filter(r => isPaid(r.key)).length;
  const totalCount = rows.length;
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const paidAmount = rows.filter(r => isPaid(r.key)).reduce((s, r) => s + r.amount, 0);
  const pendingAmount = totalAmount - paidAmount;
  const progressPct = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
  const monthLabel = format(viewDate, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-2xl font-bold flex items-center gap-2">
            <ListChecks size={24} className="text-purple-400" />
            Contas do Mês
          </h2>
          <p className="text-slate-500 text-sm mt-1">Marque o que já foi pago, como no grupo ✅</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={16} />
          Nova Conta
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between bg-[#12122a] rounded-2xl p-3 border border-purple-900/30">
        <button
          onClick={() => setOffset(o => o - 1)}
          className="p-2 rounded-xl text-slate-400 hover:bg-purple-900/20 hover:text-purple-300 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-white font-semibold capitalize">{monthLabel}</p>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="text-purple-400 text-xs hover:underline">
              Voltar para o mês atual
            </button>
          )}
        </div>
        <button
          onClick={() => setOffset(o => o + 1)}
          className="p-2 rounded-xl text-slate-400 hover:bg-purple-900/20 hover:text-purple-300 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Progress summary */}
      <div className="bg-[#12122a] rounded-2xl p-5 border border-purple-900/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-300 text-sm font-medium">
            {paidCount} de {totalCount} contas pagas
          </span>
          <span className="text-white font-bold">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 bg-[#0f0f1a] rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all ${progressPct === 100 && totalCount > 0 ? 'bg-emerald-500' : 'bg-purple-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-slate-500 text-xs">Total do mês</p>
            <p className="text-white font-bold text-sm mt-0.5">{formatCurrency(totalAmount)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Já pago</p>
            <p className="text-emerald-400 font-bold text-sm mt-0.5">{formatCurrency(paidAmount)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Falta pagar</p>
            <p className="text-amber-400 font-bold text-sm mt-0.5">{formatCurrency(pendingAmount)}</p>
          </div>
        </div>
      </div>

      {/* List */}
      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <Receipt size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-medium text-slate-500">Nenhuma conta neste mês</p>
          <p className="text-sm mt-1 text-center">
            As faturas dos cartões aparecem automaticamente.<br />
            Adicione contas fixas como luz, água e internet.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={16} />
            Adicionar Conta
          </button>
        </div>
      ) : (
        <div className="bg-[#12122a] rounded-2xl border border-purple-900/30 overflow-hidden divide-y divide-purple-900/20">
          {rows.map(row => {
            const paid = isPaid(row.key);
            return (
              <div
                key={row.key}
                className={`flex items-center gap-3 p-4 transition-colors ${paid ? 'bg-emerald-900/5' : 'hover:bg-purple-900/5'}`}
              >
                <button
                  onClick={() => togglePaid(row.key)}
                  className="flex-shrink-0 transition-transform active:scale-90"
                  aria-label={paid ? 'Marcar como não pago' : 'Marcar como pago'}
                >
                  {paid
                    ? <CheckCircle2 size={26} className="text-emerald-400" />
                    : <Circle size={26} className="text-slate-600 hover:text-purple-400" />}
                </button>

                <div className="flex-1 min-w-0" onClick={() => togglePaid(row.key)} role="button">
                  <div className="flex items-center gap-2">
                    {row.kind === 'card' && <CreditCard size={13} className="text-slate-500 flex-shrink-0" />}
                    <p className={`text-sm font-medium truncate ${paid ? 'text-slate-500 line-through' : 'text-white'}`}>
                      {row.name}
                    </p>
                  </div>
                  {row.dueDay > 0 && (
                    <p className="text-slate-600 text-xs mt-0.5">Vence dia {row.dueDay}</p>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className={`font-bold text-sm ${paid ? 'text-slate-600' : 'text-white'}`}>
                    {row.amount > 0 ? formatCurrency(row.amount) : '—'}
                  </p>
                  {paid && <p className="text-emerald-500 text-[11px] font-medium">Pago ✓</p>}
                </div>

                {row.kind === 'manual' && (
                  <button
                    onClick={() => setDeleteId(row.manualId!)}
                    className="p-1.5 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <BillForm onClose={() => setShowForm(false)} onSave={handleSaveItem} />}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#12122a] border border-purple-800/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-white text-sm mb-1">Excluir esta conta recorrente?</p>
            <p className="text-slate-500 text-xs mb-5">Ela sairá de todos os meses, inclusive os já marcados.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-purple-800/40 text-slate-400 text-sm hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDeleteItem(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
