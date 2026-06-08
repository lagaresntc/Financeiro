import React, { createContext, useContext, ReactNode } from 'react';
import { CreditCard, Purchase, FixedIncome, Investment } from '../types';
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
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useStorage<CreditCard[]>('finance_cards', []);
  const [purchases, setPurchases] = useStorage<Purchase[]>('finance_purchases', []);
  const [fixedIncomes, setFixedIncomes] = useStorage<FixedIncome[]>('finance_fixed_incomes', []);
  const [investments, setInvestments] = useStorage<Investment[]>('finance_investments', []);

  return (
    <FinanceContext.Provider value={{
      cards, setCards,
      purchases, setPurchases,
      fixedIncomes, setFixedIncomes,
      investments, setInvestments,
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
