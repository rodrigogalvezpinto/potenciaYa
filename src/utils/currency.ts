/**
 * Formatea un monto numérico a formato legal y comercial chileno en Pesos (CLP)
 * En Chile no se usan decimales para montos en moneda nacional.
 */
export function formatCLP(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '$0 CLP';
  }
  const formatted = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
  return formatted;
}

/**
 * Formatea un monto en dólares (USD) para costos de proveedor
 */
export function formatUSD(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '$0.00 USD';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

/**
 * Formatea una fecha ISO a la zona horaria de Chile (America/Santiago)
 */
export function formatChileanDate(isoString: string): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return isoString;
  }
}
