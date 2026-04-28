/**
 * Carga útil para asignar inventario desde almacén a vendedor.
 */
export interface AssignInventoryDto {
  idUser: number;
  idProduct: number;
  quantityBase: number;
}
