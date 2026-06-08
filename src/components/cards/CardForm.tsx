import { useState } from 'react';
import { X } from 'lucide-react';
import { CreditCard } from '../../types';
import { generateId } from '../../utils/finance';

const PRESET_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
  '#10b981', '#f59e0b', '#ef4444', '#ec4899',
];

interface CardFormProps {
  onClose: () => void;
  onSave: (card: CreditCard) => void;
  initial?: CreditCard;
}

export default function CardForm({ onClose, onSave, initial }: CardFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [limit, setLimit] = useState(initial?.limit?.toString() ?? '');
  const [closingDay, setClosingDay] = useState(initial?.closingDay?.toString() ?? '');
  const [dueDay, setDueDay] = useState(initial?.dueDay?.toString() ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome obrigatório';
    if (!limit || isNaN(Number(limit)) || Number(limit) <= 0) errs.limit = 'Limite inválido';
    const cd = Number(closingDay);
    if (!closingDay || isNaN(cd) || cd < 1 || cd > 31) errs.closingDay = 'Dia inválido (1–31)';
    const dd = Number(dueDay);
    if (!dueDay || isNaN(dd) || dd < 1 || dd > 31) errs.dueDay = 'Dia inválido (1–31)';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const card: CreditCard = {
      id: initial?.id ?? generateId(),
      name: name.trim(),
      color,
      limit: Number(limit),
      closingDay: Number(closingDay),
      dueDay: Number(dueDay),
    };
    onSave(card);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#12122a] border border-purple-800/40 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-purple-900/30">
          <h2 className="text-white font-semibold text-lg">{initial ? 'Editar Cartão' : 'Novo Cartão'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Nome do Cartão</label>
            <input
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
              placeholder="Ex: Nubank, Inter, XP..."
              value={name}
              onChange={e => setName(e.target.value)}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-2">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#fff' : 'transparent',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Limite (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
              placeholder="5000.00"
              value={limit}
              onChange={e => setLimit(e.target.value)}
            />
            {errors.limit && <p className="text-red-400 text-xs mt-1">{errors.limit}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Dia de Fechamento</label>
              <input
                type="number"
                min="1"
                max="31"
                className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
                placeholder="15"
                value={closingDay}
                onChange={e => setClosingDay(e.target.value)}
              />
              {errors.closingDay && <p className="text-red-400 text-xs mt-1">{errors.closingDay}</p>}
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Dia de Vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                className="w-full bg-[#0f0f1a] border border-purple-800/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
                placeholder="22"
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
              />
              {errors.dueDay && <p className="text-red-400 text-xs mt-1">{errors.dueDay}</p>}
            </div>
          </div>

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
