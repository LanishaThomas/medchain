// Central API URL — never falls back to localhost in production
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://medchain-x96u.onrender.com/api';
