/**
 * Abono al saldo general del cliente (reparto FIFO en ventas a credito abiertas).
 */
export interface RegisterCustomerBalancePaymentDto {
  idCustomer: number;
  amount: number;
}
