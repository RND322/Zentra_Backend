/**
 * Detalle de producto a registrar dentro de la venta.
 */
export interface CreateSaleItemDto {
  idProduct: number;
  quantitySale: number;
  quantityBase: number;
  unitLabel: string;
  conversionFactor: number;
  unitPrice: number;
}

/**
 * Carga útil para crear una venta.
 */
export interface CreateSaleDto {
  idUser: number;
  saleSource: "WAREHOUSE" | "SELLER";
  /** Cliente registrado en catalogo o venta informal consumidor final. */
  customerMode: "REGISTERED" | "CASUAL";
  isCredit: boolean;
  hasInvoice: boolean;
  applyIsv: boolean;
  applyIva: boolean;
  idCustomer: number | null;
  dueDate: string | null;
  items: CreateSaleItemDto[];
}
