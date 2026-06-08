import { Purchase, CreditCard } from '../types';
import { parseISO, getMonth, getYear, addMonths } from 'date-fns';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(parseISO(dateStr));
}

/**
 * Returns the installment amount for a purchase (totalAmount / installments).
 */
export function installmentAmount(purchase: Purchase): number {
  return purchase.totalAmount / purchase.installments;
}

/**
 * For a given purchase, return which calendar month/year each installment falls in.
 * installment index is 0-based.
 */
export function installmentDate(purchase: Purchase, installmentIndex: number): Date {
  return addMonths(parseISO(purchase.startDate), installmentIndex);
}

/**
 * Returns how many installments are still remaining (not yet paid) from today's month.
 */
export function remainingInstallments(purchase: Purchase, today: Date): number {
  const currentMonth = getMonth(today);
  const currentYear = getYear(today);

  let remaining = 0;
  for (let i = 0; i < purchase.installments; i++) {
    const d = installmentDate(purchase, i);
    if (getYear(d) > currentYear || (getYear(d) === currentYear && getMonth(d) >= currentMonth)) {
      remaining++;
    }
  }
  return remaining;
}

/**
 * Checks if a purchase has an installment in the given month/year.
 */
export function purchaseHasInstallmentInMonth(purchase: Purchase, month: number, year: number): boolean {
  for (let i = 0; i < purchase.installments; i++) {
    const d = installmentDate(purchase, i);
    if (getMonth(d) === month && getYear(d) === year) return true;
  }
  return false;
}

/**
 * Calculates the bill for a card in a given month/year.
 * Uses closingDay to determine which charges fall into the billing cycle.
 * Simplified: sum all purchases that have an installment in the given month.
 */
export function cardBillForMonth(card: CreditCard, purchases: Purchase[], month: number, year: number): number {
  const cardPurchases = purchases.filter(p => p.cardId === card.id);
  let total = 0;
  for (const purchase of cardPurchases) {
    for (let i = 0; i < purchase.installments; i++) {
      const d = installmentDate(purchase, i);
      if (getMonth(d) === month && getYear(d) === year) {
        total += installmentAmount(purchase);
      }
    }
  }
  return total;
}

/**
 * Returns the installment number (1-based) that falls in the given month/year for a purchase.
 * Returns null if none.
 */
export function installmentNumberForMonth(purchase: Purchase, month: number, year: number): number | null {
  for (let i = 0; i < purchase.installments; i++) {
    const d = installmentDate(purchase, i);
    if (getMonth(d) === month && getYear(d) === year) return i + 1;
  }
  return null;
}

/**
 * Returns true if the purchase is finished (all installments paid before current month).
 */
export function isPurchaseFinished(purchase: Purchase, today: Date): boolean {
  const lastInstallment = installmentDate(purchase, purchase.installments - 1);
  const currentMonth = getMonth(today);
  const currentYear = getYear(today);
  return getYear(lastInstallment) < currentYear ||
    (getYear(lastInstallment) === currentYear && getMonth(lastInstallment) < currentMonth);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
