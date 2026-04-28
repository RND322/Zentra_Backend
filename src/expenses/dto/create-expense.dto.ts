/**
 * Carga útil para registrar gasto operativo.
 */
export interface CreateExpenseDto {
  expenseDate: string;
  vendorName: string;
  idPaymentType: number;
  amount: number;
  idBusinessLine: number;
  idSubLine: number | null;
  observations: string;
}
