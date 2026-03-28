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
  const expiry = new Date(expiryDate);
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  if (expiry < now) return 'expired';
  if (expiry <= thirtyDaysFromNow) return 'expiring_soon';
  return 'valid';
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
