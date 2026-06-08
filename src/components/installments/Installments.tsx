import { useMemo, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, installmentAmount, installmentDate, isPurchaseFinished } from '../../utils/finance';
import { getMonth, getYear } from 'date-fns';
import { List, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

type FilterType = 'all' | 'active' | 'finished';

export default function Installments() {
  const { purchases, cards } = useFinance();
  const [filter, setFilter] = useState<FilterType>('active');
  const today = new Date();
  const currentMonth = getMonth(today);
  const currentYear = getYear(today);

  const installmentPurchases = useMemo(
    () => purchases.filter(p => p.installments > 1),
    [purchases]
  );

  const filtered = useMemo(() => {
    return installmentPurchases.filter(p => {
      const finished = isPurchaseFinished(p, today);
      if (filter === 'active') return !finished;
      if (filter === 'finished') return finished;
      return true;
    });
  }, [installmentPurchases, filter, today]);

  const totalMonthly = useMemo(() => {
    return filtered
      .filter(p => !isPurchaseFinished(p, today))
      .reduce((s, p) => {
        // Check if this purchase has an installment this month
        for (let i = 0; i < p.installments; i++) {
          const d = installmentDate(p, i);
          if (getMonth(d) === currentMonth && getYear(d) === currentYear) {
            return s + installmentAmount(p);
          }
        }
        return s;
      }, 0);
  }, [filtered, today, currentMonth, currentYear]);

  function getPaidCount(p: typeof purchases[0]) {
    let count = 0;
    for (let i = 0; i < p.installments; i++) {
      const d = installmentDate(p, i);
      if (getYear(d) < currentYear || (getYear(d) === currentYear && getMonth(d) <= currentMonth)) {
        count++;
      }
    }
    return Math.min(count, p.installments);
  }

  function getRemainingMonths(p: typeof purchases[0]) {
    const lastDate = installmentDate(p, p.installments - 1);
    return (getYear(lastDate) - currentYear) * 12 + (getMonth(lastDate) - currentMonth);
  }

  function isEndingSoon(p: typeof purchases[0]) {
    const months = getRemainingMonths(p);
    return months >= 0 && months <= 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold">Parcelas</h2>
        <p className="text-slate-500 text-sm mt-1">Acompanhe todas as suas compras parceladas</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#12122a] rounded-2xl p-4 border border-purple-900/30">
          <p className="text-slate-400 text-xs mb-1">Total Parceladas</p>
          <p className="text-white text-xl font-bold">{installmentPurchases.length}</p>
        </div>
        <div className="bg-[#12122a] rounded-2xl p-4 border border-purple-900/30">
          <p className="text-slate-400 text-xs mb-1">Ativas este mês</p>
          <p className="text-white text-xl font-bold">{installmentPurchases.filter(p => !isPurchaseFinished(p, today)).length}</p>
        </div>
        <div className="bg-[#12122a] rounded-2xl p-4 border border-purple-900/30">
          <p className="text-slate-400 text-xs mb-1">Débito mensal</p>
          <p className="text-rose-400 text-xl font-bold">{formatCurrency(totalMonthly)}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 bg-[#12122a] p-1.5 rounded-xl border border-purple-900/30 w-fit">
        {([
          { key: 'active', label: 'Ativas', icon: Clock },
          { key: 'finished', label: 'Quitadas', icon: CheckCircle2 },
          { key: 'all', label: 'Todas', icon: List },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === key
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {installmentPurchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <List size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-medium text-slate-500">Nenhuma parcela cadastrada</p>
          <p className="text-sm mt-1">Adicione compras parceladas nos cartões para ver aqui</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <CheckCircle2 size={40} className="mb-3 opacity-30" />
          <p className="text-slate-500">Nenhuma parcela com este filtro</p>
        </div>
      ) : (
        <div className="bg-[#12122a] rounded-2xl border border-purple-900/30 overflow-hidden">
          <div className="divide-y divide-purple-900/20">
            {filtered.map(p => {
              const card = cards.find(c => c.id === p.cardId);
              const amt = installmentAmount(p);
              const paid = getPaidCount(p);
              const remaining = p.installments - paid;
              const finished = isPurchaseFinished(p, today);
              const ending = isEndingSoon(p);

              return (
                <div
                  key={p.id}
                  className={`p-4 sm:p-5 hover:bg-purple-900/5 transition-colors ${finished ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-medium text-sm">{p.description}</span>
                        {ending && !finished && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400">
                            <AlertCircle size={10} />
                            Encerrando
                          </span>
                        )}
                        {finished && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400">
                            <CheckCircle2 size={10} />
                            Quitada
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {card && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: card.color }} />
                            {card.name}
                          </span>
                        )}
                        <span className="text-slate-600 text-xs">{p.category}</span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>{paid} de {p.installments} parcelas pagas</span>
                          <span>{remaining > 0 ? `${remaining} restante(s)` : 'Quitada'}</span>
                        </div>
                        <div className="h-1.5 bg-[#0f0f1a] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(paid / p.installments) * 100}%`,
                              backgroundColor: finished ? '#10b981' : ending ? '#f59e0b' : (card?.color ?? '#8b5cf6'),
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-white font-bold text-sm">{formatCurrency(amt)}<span className="text-slate-500 text-xs font-normal">/mês</span></p>
                      <p className="text-slate-500 text-xs mt-0.5">Total: {formatCurrency(p.totalAmount)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
