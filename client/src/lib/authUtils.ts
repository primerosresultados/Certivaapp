export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function formatRut(rut: string): string {
  const cleanRut = rut.replace(/[^0-9kK]/g, '');
  if (cleanRut.length < 2) return cleanRut;
  
  const body = cleanRut.slice(0, -1);
  const verifier = cleanRut.slice(-1).toUpperCase();
  
  let formatted = '';
  for (let i = body.length - 1, j = 0; i >= 0; i--, j++) {
    if (j > 0 && j % 3 === 0) {
      formatted = '.' + formatted;
    }
    formatted = body[i] + formatted;
  }
  
  return `${formatted}-${verifier}`;
}

export function validateRut(rut: string): boolean {
  const cleanRut = rut.replace(/[^0-9kK]/g, '');
  if (cleanRut.length < 2) return false;
  
  const body = cleanRut.slice(0, -1);
  const verifier = cleanRut.slice(-1).toUpperCase();
  
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const expectedVerifier = 11 - (sum % 11);
  let expectedChar: string;
  
  if (expectedVerifier === 11) expectedChar = '0';
  else if (expectedVerifier === 10) expectedChar = 'K';
  else expectedChar = expectedVerifier.toString();
  
  return verifier === expectedChar;
}

export function getCertificateStatus(expiryDate: string | Date): 'valid' | 'expired' | 'expiring_soon' {
  const expiry = parseDateSafe(expiryDate);
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  if (expiry < now) return 'expired';
  if (expiry <= thirtyDaysFromNow) return 'expiring_soon';
  return 'valid';
}

/**
 * Parse a date string safely to avoid timezone shifts.
 * Date-only strings like "2026-04-01" are parsed as UTC midnight by JS,
 * which in negative-UTC timezones (like Chile, UTC-3) becomes the previous day.
 * This helper appends T12:00:00 to date-only strings so the date never shifts.
 */
export function parseDateSafe(date: string | Date): Date {
  if (date instanceof Date) return date;
  if (typeof date === 'string') {
    // YYYY-MM-DD (ISO format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Date(date + 'T12:00:00');
    }
    // DD-MM-YYYY or DD/MM/YYYY (Chilean format)
    const ddmmyyyy = date.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`);
    }
  }
  return new Date(date);
}

export function formatDate(date: string | Date): string {
  return parseDateSafe(date).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Returns the proper term based on the certificate type category.
 * - "cursos" → Curso
 * - "capacitaciones" → Capacitación  
 * - "certificaciones" → Certificación
 * Falls back to "Certificado" if unknown.
 */
export function getCategoryLabel(category?: string | null): string {
  switch (category) {
    case "cursos": return "Curso";
    case "capacitaciones": return "Capacitación";
    case "certificaciones": return "Certificación";
    default: return "Certificado";
  }
}

/** Plural version */
export function getCategoryLabelPlural(category?: string | null): string {
  switch (category) {
    case "cursos": return "Cursos";
    case "capacitaciones": return "Capacitaciones";
    case "certificaciones": return "Certificaciones";
    default: return "Certificados";
  }
}
