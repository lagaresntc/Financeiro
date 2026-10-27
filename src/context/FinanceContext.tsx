import { createContext, useContext, ReactNode } from 'react';
import { CreditCard, Purchase, FixedIncome, Investment, BillItem } from '../types';
import { useStorage } from '../hooks/useStorage';

interface FinanceContextType {
  cards: CreditCard[];
  setCards: (cards: CreditCard[] | ((prev: CreditCard[]) => CreditCard[])) => void;
  purchases: Purchase[];
  setPurchases: (purchases: Purchase[] | ((prev: Purchase[]) => Purchase[])) => void;
  fixedIncomes: FixedIncome[];
  setFixedIncomes: (incomes: FixedIncome[] | ((prev: FixedIncome[]) => FixedIncome[])) => void;
  investments: Investment[];
  setInvestments: (investments: Investment[] | ((prev: Investment[]) => Investment[])) => void;
  billItems: BillItem[];
  setBillItems: (items: BillItem[] | ((prev: BillItem[]) => BillItem[])) => void;
  paidKeys: string[];
  setPaidKeys: (keys: string[] | ((prev: string[]) => string[])) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useStorage<CreditCard[]>('finance_cards', []);
  const [purchases, setPurchases] = useStorage<Purchase[]>('finance_purchases', []);
  const [fixedIncomes, setFixedIncomes] = useStorage<FixedIncome[]>('finance_fixed_incomes', []);
  const [investments, setInvestments] = useStorage<Investment[]>('finance_investments', []);
  const [billItems, setBillItems] = useStorage<BillItem[]>('finance_bill_items', []);
  const [paidKeys, setPaidKeys] = useStorage<string[]>('finance_paid_keys', []);

  return (
    <FinanceContext.Provider value={{
      cards, setCards,
      purchases, setPurchases,
      fixedIncomes, setFixedIncomes,
      investments, setInvestments,
      billItems, setBillItems,
      paidKeys, setPaidKeys,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
