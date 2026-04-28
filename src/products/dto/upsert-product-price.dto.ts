/**
 * Carga útil para crear/actualizar precio fijo activo.
 */
export interface UpsertProductPriceDto {
  idProduct: number;
  unitLabel: string;
  price: number;
}
