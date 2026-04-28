/**
 * Devolucion de vendedor a almacen.
 */
export interface TransferToWarehouseDto {
  idProduct: number;
  idUser: number;
  quantityBase: number;
  reason: string;
}

/**
 * Transferencia entre dos vendedores.
 */
export interface TransferUserToUserDto {
  idProduct: number;
  fromUserId: number;
  toUserId: number;
  quantityBase: number;
  reason: string;
}
