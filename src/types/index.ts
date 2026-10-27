export interface CreditCard {
  id: string;
  name: string;
  color: string;
  limit: number;
  closingDay: number;
  dueDay: number;
}

export interface Purchase {
  id: string;
  cardId: string;
  description: string;
  totalAmount: number;
  installments: number;
  currentInstallment: number;
  startDate: string;
  category: string;
}

export interface FixedIncome {
  id: string;
  description: string;
  amount: number;
  dayOfMonth: number;
}

export interface Investment {
  id: string;
  name: string;
  type: 'savings' | 'cdb' | 'stocks' | 'crypto' | 'other';
  amount: number;
  yieldPercent?: number;
  updatedAt: string;
}

export interface BillItem {
  id: string;
  name: string;
  amount: number; // 0 = valor variável
  dueDay: number; // dia de vencimento (0 = sem dia definido)
}

export type NavTab =
  | 'dashboard'
  | 'simulator'
  | 'cards'
  | 'installments'
  | 'checklist'
  | 'investments'
  | 'income';
