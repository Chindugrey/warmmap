import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
export const nanoid = customAlphabet(alphabet, 8);

export function generateShortSlug(): string {
  return nanoid();
}

export function hashEmail(email: string): string {
  // Simple stable hash for analytics; not for security.
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (h << 5) - h + email.charCodeAt(i);
    h |= 0;
  }
  return "h" + Math.abs(h).toString(36);
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
