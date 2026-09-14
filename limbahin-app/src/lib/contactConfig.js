// Single source of truth for CS / internal contact details, so a future number/email change is
// a one-line edit instead of a grep across the codebase.

// CS WhatsApp number customers get redirected to after submitting a quotation or registration.
// wa.me needs the number in international format with no leading 0 / spaces / punctuation.
export const CS_WHATSAPP_NUMBER = '628512800' + '5532'; // 0851 2800 5532 -> 62 851 2800 5532
export const CS_WHATSAPP_DISPLAY = '0851 2800 5532';

export function buildWhatsAppLink(message) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${CS_WHATSAPP_NUMBER}?text=${encoded}`;
}

// Email recipients for the quotation + contract-draft emails sent from the Supabase Edge
// Functions. Customer is always BCC (so they never see internal addresses in "To"/"Cc").
export const EMAIL_MAIN_TO = 'kontrak@mediacahayacerah.com';
export const EMAIL_CC = ['kelvinfiless@gmail.com'];
