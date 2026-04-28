/**
 * Carga útil para actualizar configuración SMTP.
 */
export interface UpdateSmtpSettingDto {
  host: string;
  port: number;
  username: string;
  encryptedPassword: string;
  encryption: "TLS" | "SSL" | "NONE";
  senderEmail: string;
  senderName: string;
  isActive: boolean;
}
