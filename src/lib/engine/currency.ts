/**
 * ============================================
 * FinEngine 2026 - Валютные операции
 * ============================================
 * Переоценка валютных остатков на конец месяца,
 * расчёт курсовых разниц.
 */

import { Transaction, ExchangeRate, Account } from './types';

export class CurrencyEngine {
  
  /**
   * Переоценка валютных остатков на конец месяца
   * Создаёт системные операции для отражения курсовых разниц
   */
  revaluateBalances(
    transactions: Transaction[],
    accounts: Account[],
    exchangeRates: ExchangeRate[],
    companyId: string,
    date: string // Последний день месяца
  ): Transaction[] {
    
    const revaluationTransactions: Transaction[] = [];
    
    // Находим все валютные операции до указанной даты
    const currencyTransactions = transactions.filter(t =>
      t.company_id === companyId &&
      t.date <= date &&
      t.currency !== 'RUB'
    );
    
    // Группируем по валютам
    const currencyGroups = this.groupByCurrency(currencyTransactions);
    
    for (const [currency, currencyTransactions] of currencyGroups) {
      
      // Текущий курс на дату переоценки
      const currentRate = this.getRateOnDate(exchangeRates, currency, date);
      if (!currentRate) continue;
      
      // Считаем остаток в валюте
      const balanceInCurrency = this.calculateBalanceInCurrency(
        currencyTransactions,
        accounts
      );
      
      // Считаем остаток в рублях по текущему курсу
      const balanceInRubles = balanceInCurrency * currentRate;
      
      // Считаем остаток в рублях по старым курсам
      const balanceInRublesOld = currencyTransactions.reduce((sum, t) => {
        const oldRate = this.getRateOnDate(exchangeRates, currency, t.date);
        return sum + (t.amount * (oldRate || 0));
      }, 0);
      
      // Курсовая разница
      const difference = balanceInRubles - balanceInRublesOld;
      
      if (Math.abs(difference) > 0.01) {
        // Создаём системную операцию для курсовой разницы
        const revaluationTransaction: Transaction = {
          id: this.generateId(),
          transaction_group_id: this.generateId(),
          date: date,
          company_id: companyId,
          description: `Переоценка валютных остатков ${currency}`,
          amount: Math.abs(difference),
          currency: 'RUB',
          amount_rub: Math.abs(difference),
          counterparty_id: '',
          contract_id: '',
          debit_account_id: difference > 0 ? 'acc-bank-001' : 'acc-exp-currency',
          credit_account_id: difference > 0 ? 'acc-rev-currency' : 'acc-bank-001',
          is_system: true
        };
        
        revaluationTransactions.push(revaluationTransaction);
      }
    }
    
    return revaluationTransactions;
  }
  
  /**
   * Конвертация валюты
   */
  convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    exchangeRates: ExchangeRate[],
    date: string
  ): number {
    
    if (fromCurrency === toCurrency) return amount;
    
    // Если из рублей
    if (fromCurrency === 'RUB') {
      const rate = this.getRateOnDate(exchangeRates, toCurrency, date);
      return rate ? amount / rate : 0;
    }
    
    // Если в рубли
    if (toCurrency === 'RUB') {
      const rate = this.getRateOnDate(exchangeRates, fromCurrency, date);
      return rate ? amount * rate : 0;
    }
    
    // Кросс-курс
    const fromRate = this.getRateOnDate(exchangeRates, fromCurrency, date);
    const toRate = this.getRateOnDate(exchangeRates, toCurrency, date);
    
    if (fromRate && toRate) {
      return amount * (fromRate / toRate);
    }
    
    return 0;
  }
  
  /**
   * Получение курса на дату
   */
  private getRateOnDate(
    exchangeRates: ExchangeRate[],
    currency: string,
    date: string
  ): number | null {
    
    // Находим ближайший курс до указанной даты
    const ratesOnDate = exchangeRates
      .filter(r => r.currency === currency && r.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date));
    
    return ratesOnDate.length > 0 ? ratesOnDate[0].rate : null;
  }
  
  /**
   * Группировка транзакций по валютам
   */
  private groupByCurrency(
    transactions: Transaction[]
  ): Map<string, Transaction[]> {
    
    const groups = new Map<string, Transaction[]>();
    
    for (const t of transactions) {
      if (!groups.has(t.currency)) {
        groups.set(t.currency, []);
      }
      groups.get(t.currency)!.push(t);
    }
    
    return groups;
  }
  
  /**
   * Расчёт остатка в валюте
   */
  private calculateBalanceInCurrency(
    transactions: Transaction[],
    accounts: Account[]
  ): number {
    
    let balance = 0;
    
    for (const t of transactions) {
      const debitAccount = accounts.find(a => a.id === t.debit_account_id);
      const creditAccount = accounts.find(a => a.id === t.credit_account_id);
      
      if (!debitAccount || !creditAccount) continue;
      
      if (debitAccount.code === 'BANK_MAIN') {
        balance += t.amount;
      }
      if (creditAccount.code === 'BANK_MAIN') {
        balance -= t.amount;
      }
    }
    
    return balance;
  }
  
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export const currencyEngine = new CurrencyEngine();