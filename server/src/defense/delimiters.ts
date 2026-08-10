export const UNTRUSTED_OPEN = "<untrusted_resume_data>";
export const UNTRUSTED_CLOSE = "</untrusted_resume_data>";

export function wrapUntrusted(text: string): string {
  return `${UNTRUSTED_OPEN}\n${text}\n${UNTRUSTED_CLOSE}`;
}
