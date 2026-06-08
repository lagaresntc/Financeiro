import { useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, cardBillForMonth, installmentDate, installmentAmount, isPurchaseFinished } from '../../utils/finance';
import { getMonth, getYear, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, CreditCard, BarChart2, LucideIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#12122a] rounded-2xl p-5 border border-purple-900/30 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <div>
        <p className="text-white text-2xl font-bold">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a35] border border-purple-800/50 rounded-xl p-3 shadow-xl">
        <p className="text-slate-300 text-xs mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { cards, purchases, fixedIncomes, investments } = useFinance();
  const today = new Date();
  const currentMonth = getMonth(today);
  const currentYear = getYear(today);

  const totalIncome = useMemo(() => fixedIncomes.reduce((s, i) => s + i.amount, 0), [fixedIncomes]);

  const totalBill = useMemo(
    () => cards.reduce((s, c) => s + cardBillForMonth(c, purchases, currentMonth, currentYear), 0),
    [cards, purchases, currentMonth, currentYear]
  );

  const remaining = totalIncome - totalBill;

  const totalInvestments = useMemo(() => investments.reduce((s, i) => s + i.amount, 0), [investments]);

  // Installments ending this month or next month
  const endingSoon = useMemo(() => {
    return purchases.filter(p => {
      if (p.installments <= 1) return false;
      if (isPurchaseFinished(p, today)) return false;
      const lastDate = installmentDate(p, p.installments - 1);
      const monthsLeft =
        (getYear(lastDate) - currentYear) * 12 + (getMonth(lastDate) - currentMonth);
      return monthsLeft <= 1 && monthsLeft >= 0;
    });
  }, [purchases, today, currentMonth, currentYear]);

  // Chart data: last 6 months bill estimates
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const m = getMonth(d);
      const y = getYear(d);
      const bill = cards.reduce((s, c) => s + cardBillForMonth(c, purchases, m, y), 0);
      months.push({
        name: format(d, 'MMM', { locale: ptBR }),
        Fatura: Math.round(bill * 100) / 100,
        Receita: totalIncome,
      });
    }
    return months;
  }, [cards, purchases, currentMonth, currentYear, totalIncome]);

  const monthLabel = format(today, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold capitalize">{monthLabel}</h2>
        <p className="text-slate-500 text-sm mt-1">Resumo financeiro do mês atual</p>
      </div>

      {remaining < 0 && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-400">
          <AlertTriangle size={20} />
          <p className="text-sm font-medium">
            Atenção: suas faturas ({formatCurrency(totalBill)}) superam sua receita ({formatCurrency(totalIncome)}) em {formatCurrency(Math.abs(remaining))}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Receita Mensal"
          value={formatCurrency(totalIncome)}
          icon={TrendingUp}
          color="bg-emerald-600"
          sub={`${fixedIncomes.length} fonte(s) de renda`}
        />
        <StatCard
          label="Total Faturas"
          value={formatCurrency(totalBill)}
          icon={CreditCard}
          color="bg-rose-600"
          sub={`${cards.length} cartão(ões)`}
        />
        <StatCard
          label="Saldo Restante"
          value={formatCurrency(remaining)}
          icon={remaining >= 0 ? Wallet : TrendingDown}
          color={remaining >= 0 ? 'bg-indigo-600' : 'bg-amber-600'}
          sub={remaining >= 0 ? 'Disponível no mês' : 'Déficit no mês'}
        />
        <StatCard
          label="Investimentos"
          value={formatCurrency(totalInvestments)}
          icon={BarChart2}
          color="bg-purple-600"
          sub={`${investments.length} aplicação(ões)`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="xl:col-span-2 bg-[#12122a] rounded-2xl p-5 border border-purple-900/30">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BarChart2 size={18} className="text-purple-400" />
            Histórico de Faturas vs Receita
          </h3>
          {cards.length === 0 && purchases.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
              Adicione cartões e compras para ver o gráfico
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Receita" fill="#6d28d9" radius={[4, 4, 0, 0]} opacity={0.6} />
                <Bar dataKey="Fatura" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cards bill breakdown */}
        <div className="bg-[#12122a] rounded-2xl p-5 border border-purple-900/30">
          <h3 className="text-white font-semibold mb-4">Fatura por Cartão</h3>
          {cards.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[120px] text-slate-600 text-sm">
              Nenhum cartão cadastrado
            </div>
          ) : (
            <div className="space-y-3">
              {cards.map(card => {
                const bill = cardBillForMonth(card, purchases, currentMonth, currentYear);
                const pct = totalBill > 0 ? (bill / totalBill) * 100 : 0;
                return (
                  <div key={card.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: card.color }}
                        />
                        <span className="text-slate-300 text-sm">{card.name}</span>
                      </div>
                      <span className="text-white text-sm font-semibold">{formatCurrency(bill)}</span>
                    </div>
                    <div className="h-1.5 bg-[#1a1a35] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: card.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ending soon */}
      {endingSoon.length > 0 && (
        <div className="bg-[#12122a] rounded-2xl p-5 border border-amber-700/30">
          <h3 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            Parcelas Encerrando em Breve
          </h3>
          <div className="space-y-2">
            {endingSoon.map(p => {
              const card = cards.find(c => c.id === p.cardId);
              const lastDate = installmentDate(p, p.installments - 1);
              const monthsLeft =
                (getYear(lastDate) - currentYear) * 12 + (getMonth(lastDate) - currentMonth);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-amber-900/10 border border-amber-700/20 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{p.description}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {card?.name} · {formatCurrency(installmentAmount(p))}/mês ·{' '}
                      {monthsLeft === 0 ? 'Última parcela este mês!' : 'Penúltima parcela'}
                    </p>
                  </div>
                  <span className="text-amber-400 text-xs font-semibold bg-amber-900/30 px-2 py-1 rounded-lg">
                    {p.installments - p.currentInstallment + 1} restante(s)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fixed incomes summary */}
      {fixedIncomes.length > 0 && (
        <div className="bg-[#12122a] rounded-2xl p-5 border border-purple-900/30">
          <h3 className="text-white font-semibold mb-3">Receitas do Mês</h3>
          <div className="divide-y divide-purple-900/20">
            {fixedIncomes.map(income => (
              <div key={income.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-slate-300 text-sm">{income.description}</p>
                  <p className="text-slate-600 text-xs">Dia {income.dayOfMonth}</p>
                </div>
                <span className="text-emerald-400 font-semibold text-sm">{formatCurrency(income.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
