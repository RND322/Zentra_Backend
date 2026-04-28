/**
 * Carga útil para registrar producción.
 */
export interface CreateProductionDto {
  idProduct: number;
  quantityBase: number;
  climate: string;
  productionDate: string;
}
