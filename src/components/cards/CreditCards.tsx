import { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import {
  formatCurrency,
  cardBillForMonth,
  installmentAmount,
  isPurchaseFinished,
  installmentDate,
} from '../../utils/finance';
import { getMonth, getYear, format } from 'date-fns';
import { Plus, Edit2, Trash2, CreditCard as CardIcon, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import { CreditCard, Purchase } from '../../types';
import CardForm from './CardForm';
import PurchaseForm from './PurchaseForm';

function DeleteConfirm({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#12122a] border border-purple-800/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <p className="text-white text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-purple-800/40 text-slate-400 text-sm hover:text-white transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseRow({ purchase, today, onEdit, onDelete }: {
  purchase: Purchase;
  today: Date;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const finished = isPurchaseFinished(purchase, today);
  const amt = installmentAmount(purchase);
  const currentMonth = getMonth(today);
  const currentYear = getYear(today);

  let paidCount = 0;
  for (let i = 0; i < purchase.installments; i++) {
    const d = installmentDate(purchase, i);
    if (getYear(d) < currentYear || (getYear(d) === currentYear && getMonth(d) <= currentMonth)) {
      paidCount++;
    }
  }
  const remaining = purchase.installments - paidCount;

  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-xl transition-colors ${finished ? 'opacity-50' : 'hover:bg-purple-900/10'}`}>
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-200 text-sm font-medium truncate">{purchase.description}</span>
          {purchase.installments > 1 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${finished ? 'bg-slate-700 text-slate-400' : 'bg-purple-900/40 text-purple-300'}`}>
              {paidCount}/{purchase.installments}x
            </span>
          )}
          {finished && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400">Quitada</span>}
        </div>
        <p className="text-slate-500 text-xs mt-0.5">{purchase.category} · {format(new Date(purchase.startDate + 'T12:00:00'), 'dd/MM/yyyy')}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-white text-sm font-semibold">{formatCurrency(amt)}<span className="text-slate-500 font-normal">/mês</span></p>
          {purchase.installments > 1 && !finished && (
            <p className="text-slate-500 text-xs">{remaining} restante(s)</p>
          )}
        </div>
        <button onClick={onEdit} className="text-slate-600 hover:text-purple-400 transition-colors p-1">
          <Edit2 size={14} />
        </button>
        <button onClick={onDelete} className="text-slate-600 hover:text-red-400 transition-colors p-1">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function CardPanel({ card, purchases, today }: { card: CreditCard; purchases: Purchase[]; today: Date }) {
  const { setCards, setPurchases } = useFinance();
  const [expanded, setExpanded] = useState(true);
  const [showCardForm, setShowCardForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | undefined>();
  const [deleteCardConfirm, setDeleteCardConfirm] = useState(false);
  const [deletePurchaseId, setDeletePurchaseId] = useState<string | null>(null);

  const currentMonth = getMonth(today);
  const currentYear = getYear(today);
  const bill = cardBillForMonth(card, purchases, currentMonth, currentYear);
  const usedPct = card.limit > 0 ? Math.min((bill / card.limit) * 100, 100) : 0;

  const cardPurchases = purchases.filter(p => p.cardId === card.id);
  const activePurchases = cardPurchases.filter(p => !isPurchaseFinished(p, today));
  const finishedPurchases = cardPurchases.filter(p => isPurchaseFinished(p, today));

  function handleEditCard(updated: CreditCard) {
    setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
    setShowCardForm(false);
  }

  function handleDeleteCard() {
    setCards(prev => prev.filter(c => c.id !== card.id));
    setPurchases(prev => prev.filter(p => p.cardId !== card.id));
  }

  function handleSavePurchase(purchase: Purchase) {
    if (editingPurchase) {
      setPurchases(prev => prev.map(p => p.id === purchase.id ? purchase : p));
    } else {
      setPurchases(prev => [...prev, purchase]);
    }
    setShowPurchaseForm(false);
    setEditingPurchase(undefined);
  }

  function handleDeletePurchase(id: string) {
    setPurchases(prev => prev.filter(p => p.id !== id));
    setDeletePurchaseId(null);
  }

  return (
    <>
      <div className="bg-[#12122a] border border-purple-900/30 rounded-2xl overflow-hidden">
        {/* Card header */}
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: card.color + '25' }}>
                <CardIcon size={20} style={{ color: card.color }} />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg leading-none">{card.name}</h3>
                <p className="text-slate-500 text-xs mt-1">
                  Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowCardForm(true)}
                className="p-2 text-slate-500 hover:text-purple-400 transition-colors rounded-lg hover:bg-purple-900/20"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={() => setDeleteCardConfirm(true)}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-900/10"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Fatura atual</span>
              <span className="text-white font-semibold">{formatCurrency(bill)}</span>
            </div>
            <div className="h-2 bg-[#0f0f1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${usedPct}%`, backgroundColor: card.color }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>{usedPct.toFixed(1)}% do limite</span>
              <span>Limite: {formatCurrency(card.limit)}</span>
            </div>
          </div>
        </div>

        {/* Purchases section */}
        <div className="border-t border-purple-900/20">
          <div className="flex items-center justify-between px-5 py-3">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {cardPurchases.length} compra(s)
            </button>
            <button
              onClick={() => { setEditingPurchase(undefined); setShowPurchaseForm(true); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
            >
              <Plus size={13} />
              Adicionar
            </button>
          </div>

          {expanded && (
            <div className="px-2 pb-3">
              {activePurchases.length === 0 && finishedPurchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                  <ShoppingBag size={28} className="mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma compra cadastrada</p>
                  <p className="text-xs mt-1">Clique em "Adicionar" para registrar</p>
                </div>
              ) : (
                <div className="divide-y divide-purple-900/10">
                  {activePurchases.map(p => (
                    <PurchaseRow
                      key={p.id}
                      purchase={p}
                      today={today}
                      onEdit={() => { setEditingPurchase(p); setShowPurchaseForm(true); }}
                      onDelete={() => setDeletePurchaseId(p.id)}
                    />
                  ))}
                  {finishedPurchases.map(p => (
                    <PurchaseRow
                      key={p.id}
                      purchase={p}
                      today={today}
                      onEdit={() => { setEditingPurchase(p); setShowPurchaseForm(true); }}
                      onDelete={() => setDeletePurchaseId(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCardForm && (
        <CardForm
          initial={card}
          onClose={() => setShowCardForm(false)}
          onSave={handleEditCard}
        />
      )}
      {showPurchaseForm && (
        <PurchaseForm
          card={card}
          initial={editingPurchase}
          onClose={() => { setShowPurchaseForm(false); setEditingPurchase(undefined); }}
          onSave={handleSavePurchase}
        />
      )}
      {deleteCardConfirm && (
        <DeleteConfirm
          message={`Excluir o cartão "${card.name}" e todas as suas compras?`}
          onConfirm={handleDeleteCard}
          onCancel={() => setDeleteCardConfirm(false)}
        />
      )}
      {deletePurchaseId && (
        <DeleteConfirm
          message="Excluir esta compra?"
          onConfirm={() => handleDeletePurchase(deletePurchaseId)}
          onCancel={() => setDeletePurchaseId(null)}
        />
      )}
    </>
  );
}

export default function CreditCards() {
  const { cards, setCards, purchases } = useFinance();
  const [showCardForm, setShowCardForm] = useState(false);
  const today = new Date();

  function handleAddCard(card: CreditCard) {
    setCards(prev => [...prev, card]);
    setShowCardForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-2xl font-bold">Cartões de Crédito</h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie seus cartões e compras</p>
        </div>
        {cards.length < 3 && (
          <button
            onClick={() => setShowCardForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={16} />
            Novo Cartão
          </button>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <CardIcon size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-medium text-slate-500">Nenhum cartão cadastrado</p>
          <p className="text-sm mt-1 text-center max-w-xs">
            Adicione até 3 cartões de crédito para controlar suas faturas e parcelas
          </p>
          <button
            onClick={() => setShowCardForm(true)}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={16} />
            Adicionar Cartão
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {cards.map(card => (
            <CardPanel key={card.id} card={card} purchases={purchases} today={today} />
          ))}
        </div>
      )}

      {cards.length >= 3 && (
        <p className="text-slate-600 text-sm text-center">Limite de 3 cartões atingido.</p>
      )}

      {showCardForm && (
        <CardForm onClose={() => setShowCardForm(false)} onSave={handleAddCard} />
      )}
    </div>
  );
}
