import { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, cardBillForMonth } from '../../utils/finance';
import { getMonth, getYear } from 'date-fns';
import { ShoppingCart, Calculator, CheckCircle2, AlertTriangle, XCircle, CreditCard } from 'lucide-react';

type Verdict = 'safe' | 'warn' | 'danger';

interface SimResult {
  monthlyPayment: number;
  totalAmount: number;
  income: number;
  currentCommitted: number;
  newCommitted: number;
  commitmentPct: number;
  freeBalance: number;
  verdict: Verdict;
}

const VERDICTS: Record<Verdict, { label: string; sub: string; Icon: typeof CheckCircle2; color: string; bg: string; border: string; bar: string }> = {
  safe: {
    label: 'Compra confortável',
    sub: 'Cabe tranquilo no seu orçamento.',
    Icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-900/20',
    border: 'border-emerald-700/40',
    bar: 'bg-emerald-500',
  },
  warn: {
    label: 'Atenção',
    sub: 'Dá pra fazer, mas vai apertar. Pense bem.',
    Icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-900/20',
    border: 'border-amber-700/40',
    bar: 'bg-amber-500',
  },
  danger: {
    label: 'Vai comprometer demais sua renda',
    sub: 'O ideal é adiar ou buscar um valor de parcela menor.',
    Icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-900/20',
    border: 'border-red-700/40',
    bar: 'bg-red-500',
  },
};

export default function Simulator() {
  const { cards, purchases, fixedIncomes } = useFinance();
  const today = new Date();
  const currentMonth = getMonth(today);
  const currentYear = getYear(today);

  const [description, setDescription] = useState('');
  const [installments, setInstallments] = useState('1');
  const [installmentValue, setInstallmentValue] = useState('');
  const [cardId, setCardId] = useState('');

  const income = useMemo(() => fixedIncomes.reduce((s, i) => s + i.amount, 0), [fixedIncomes]);
  const currentCommitted = useMemo(
    () => cards.reduce((s, c) => s + cardBillForMonth(c, purchases, currentMonth, currentYear), 0),
    [cards, purchases, currentMonth, currentYear]
  );

  const result = useMemo<SimResult | null>(() => {
    const n = Number(installments);
    const val = Number(installmentValue);
    if (!val || isNaN(val) || val <= 0 || !n || n < 1) return null;

    const monthlyPayment = val;
    const totalAmount = val * n;
    const newCommitted = currentCommitted + monthlyPayment;
    const commitmentPct = income > 0 ? (newCommitted / income) * 100 : (newCommitted > 0 ? 100 : 0);
    const freeBalance = income - newCommitted;

    let verdict: Verdict;
    if (freeBalance < 0 || commitmentPct > 70) verdict = 'danger';
    else if (commitmentPct > 50) verdict = 'warn';
    else verdict = 'safe';

    return { monthlyPayment, totalAmount, income, currentCommitted, newCommitted, commitmentPct, freeBalance, verdict };
  }, [installments, installmentValue, currentCommitted, income]);

  const v = result ? VERDICTS[result.verdict] : null;
  const barPct = result ? Math.min(result.commitmentPct, 100) : 0;
  const selectedCard = cards.find(c => c.id === cardId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold flex items-center gap-2">
          <ShoppingCart size={24} className="text-purple-400" />
          Simulador de Compra
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Veja o impacto antes de comprar algo parcelado
        </p>
      </div>

      {income === 0 && (
        <div className="flex items-center gap-3 bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 text-amber-400">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <p className="text-sm">
            Você ainda não cadastrou nenhuma <strong>Receita Fixa</strong>. Cadastre sua renda para o
            simulador calcular o comprometimento corretamente.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-[#12122a] rounded-2xl p-5 border border-purple-900/30 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Calculator size={18} className="text-purple-400" />
            O que você quer comprar?
          </h3>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Descrição</label>
            <input
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
              placeholder="Ex: Notebook, Geladeira..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Nº de parcelas</label>
              <input
                type="number"
                min="1"
                className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
                placeholder="12"
                value={installments}
                onChange={e => setInstallments(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Valor da parcela (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
                placeholder="280.00"
                value={installmentValue}
                onChange={e => setInstallmentValue(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Cartão (opcional)</label>
            <select
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
              value={cardId}
              onChange={e => setCardId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {cards.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {result && (
            <div className="bg-[#0f0f1a] rounded-xl p-4 border border-purple-900/20 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Valor por mês</span>
                <span className="text-white font-semibold">{formatCurrency(result.monthlyPayment)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Valor total</span>
                <span className="text-white font-semibold">{formatCurrency(result.totalAmount)}</span>
              </div>
              {selectedCard && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <CreditCard size={13} /> No cartão
                  </span>
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedCard.color }} />
                    {selectedCard.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Result */}
        <div className="bg-[#12122a] rounded-2xl p-5 border border-purple-900/30">
          <h3 className="text-white font-semibold mb-4">Resultado da simulação</h3>

          {!result ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-600 text-center">
              <Calculator size={44} className="mb-4 opacity-30" />
              <p className="text-sm">Preencha o número de parcelas e o valor<br />para ver a simulação</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Verdict banner */}
              {v && (
                <div className={`flex items-start gap-3 ${v.bg} border ${v.border} rounded-xl p-4`}>
                  <v.Icon size={22} className={`${v.color} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className={`${v.color} font-semibold`}>{v.label}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{v.sub}</p>
                  </div>
                </div>
              )}

              {/* Commitment bar */}
              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-slate-400 text-sm">Novo comprometimento da renda</span>
                  <span className={`text-2xl font-bold ${v?.color}`}>{result.commitmentPct.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-[#0f0f1a] rounded-full overflow-hidden relative">
                  <div className={`h-full rounded-full transition-all ${v?.bar}`} style={{ width: `${barPct}%` }} />
                  {/* 50% and 70% markers */}
                  <div className="absolute top-0 h-full w-px bg-slate-600/60" style={{ left: '50%' }} />
                  <div className="absolute top-0 h-full w-px bg-slate-600/60" style={{ left: '70%' }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>70%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Numbers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0f0f1a] rounded-xl p-4 border border-purple-900/20">
                  <p className="text-slate-500 text-xs mb-1">Já comprometido/mês</p>
                  <p className="text-white font-bold">{formatCurrency(result.currentCommitted)}</p>
                </div>
                <div className="bg-[#0f0f1a] rounded-xl p-4 border border-purple-900/20">
                  <p className="text-slate-500 text-xs mb-1">+ Esta compra/mês</p>
                  <p className="text-white font-bold">{formatCurrency(result.monthlyPayment)}</p>
                </div>
                <div className="bg-[#0f0f1a] rounded-xl p-4 border border-purple-900/20">
                  <p className="text-slate-500 text-xs mb-1">Sua renda/mês</p>
                  <p className="text-white font-bold">{formatCurrency(result.income)}</p>
                </div>
                <div className={`rounded-xl p-4 border ${result.freeBalance >= 0 ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-red-900/10 border-red-800/30'}`}>
                  <p className="text-slate-500 text-xs mb-1">Novo saldo livre/mês</p>
                  <p className={`font-bold ${result.freeBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(result.freeBalance)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
