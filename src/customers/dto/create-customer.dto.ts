/**
 * Alta de cliente registrado.
 * Telefono, direccion y lugar son obligatorios en alta.
 */
export interface CreateCustomerDto {
  customerName: string;
  phone: string;
  address: string;
  /** Id de CatalogItem activo con catalogType customer_places. */
  idPlace: number;
}
