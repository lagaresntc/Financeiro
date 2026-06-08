import { useState } from 'react';
import { X } from 'lucide-react';
import { Purchase, CreditCard } from '../../types';
import { generateId } from '../../utils/finance';
import { format } from 'date-fns';

const CATEGORIES = [
  'Alimentação', 'Transporte', 'Saúde', 'Educação',
  'Lazer', 'Vestuário', 'Moradia', 'Tecnologia', 'Viagem', 'Outros',
];

interface PurchaseFormProps {
  card: CreditCard;
  onClose: () => void;
  onSave: (purchase: Purchase) => void;
  initial?: Purchase;
}

export default function PurchaseForm({ card, onClose, onSave, initial }: PurchaseFormProps) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [description, setDescription] = useState(initial?.description ?? '');
  const [totalAmount, setTotalAmount] = useState(initial?.totalAmount?.toString() ?? '');
  const [installments, setInstallments] = useState(initial?.installments?.toString() ?? '1');
  const [startDate, setStartDate] = useState(initial?.startDate ?? today);
  const [category, setCategory] = useState(initial?.category ?? 'Outros');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!description.trim()) errs.description = 'Descrição obrigatória';
    if (!totalAmount || isNaN(Number(totalAmount)) || Number(totalAmount) <= 0) errs.totalAmount = 'Valor inválido';
    const inst = Number(installments);
    if (!installments || isNaN(inst) || inst < 1 || inst > 72) errs.installments = 'Parcelas: 1–72';
    if (!startDate) errs.startDate = 'Data obrigatória';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const purchase: Purchase = {
      id: initial?.id ?? generateId(),
      cardId: card.id,
      description: description.trim(),
      totalAmount: Number(totalAmount),
      installments: Number(installments),
      currentInstallment: initial?.currentInstallment ?? 1,
      startDate,
      category,
    };
    onSave(purchase);
  }

  const monthlyAmount =
    totalAmount && !isNaN(Number(totalAmount)) && Number(installments) > 0
      ? Number(totalAmount) / Number(installments)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#12122a] border border-purple-800/40 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-purple-900/30">
          <div>
            <h2 className="text-white font-semibold text-lg">{initial ? 'Editar Compra' : 'Nova Compra'}</h2>
            <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: card.color }}
              />
              {card.name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Descrição</label>
            <input
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
              placeholder="Ex: Netflix, Mercado, Viagem..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Valor Total (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
              placeholder="299.90"
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
            />
            {errors.totalAmount && <p className="text-red-400 text-xs mt-1">{errors.totalAmount}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Parcelas</label>
              <input
                type="number"
                min="1"
                max="72"
                className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
                placeholder="1"
                value={installments}
                onChange={e => setInstallments(e.target.value)}
              />
              {errors.installments && <p className="text-red-400 text-xs mt-1">{errors.installments}</p>}
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Data da 1ª Parcela</label>
              <input
                type="date"
                className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              {errors.startDate && <p className="text-red-400 text-xs mt-1">{errors.startDate}</p>}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Categoria</label>
            <select
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {monthlyAmount !== null && Number(installments) > 1 && (
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-xl px-4 py-3">
              <p className="text-slate-400 text-xs">Valor por parcela:</p>
              <p className="text-purple-300 text-lg font-bold">
                R$ {monthlyAmount.toFixed(2).replace('.', ',')}
                <span className="text-slate-500 text-sm font-normal"> × {installments}x</span>
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-purple-800/40 text-slate-400 text-sm hover:text-white hover:border-purple-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
