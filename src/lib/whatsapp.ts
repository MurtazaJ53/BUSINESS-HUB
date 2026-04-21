/**
 * Elite WhatsApp Utility
 * frictionless onboarding for local teams.
 */

export function sendWhatsAppInvite({
  phone,
  staffName,
  inviteCode,
  shopName,
}: {
  phone: string;
  staffName: string;
  inviteCode: string;
  shopName: string;
}) {
  const joinLink = `${window.location.origin}/?invite=${inviteCode}`;
  
  // Clean phone number (remove spaces, dashes, etc.)
  let cleanPhone = phone.replace(/\D/g, '');
  
  // If it's a 10-digit number without country code, prepend 91 (India)
  if (cleanPhone.length === 10 && !phone.startsWith('+')) {
    cleanPhone = `91${cleanPhone}`;
  }
  
  const message = 
    `--- [ *${shopName}* ] ---\n\n` +
    `Hello *${staffName}*,\n` +
    `You are invited to join our professional team on *Business Hub Pro*.\n\n` +
    `*INVITATION CODE:* ${inviteCode}\n\n` +
    `>> *JOIN VIA WEBSITE:* \n` +
    `${joinLink}\n\n` +
    `>> *JOIN VIA ANDROID APP:* \n` +
    `Open the APK, tap 'Join Team', and enter your code.\n\n` +
    `Welcome aboard!`;

  const encodedMsg = encodeURIComponent(message);
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

  // Open WhatsApp
  window.open(waUrl, '_blank');
}

export function shareInviteWhatsApp(inviteCode: string, shopName: string) {
  const joinLink = `${window.location.origin}/?invite=${inviteCode}`;
  
  const message = 
    `--- [ *TEAM INVITE* ] ---\n` +
    `Shop: *${shopName}*\n\n` +
    `Use this code to join our hub on Business Hub Pro:\n\n` +
    `*CODE:* ${inviteCode}\n\n` +
    `>> *DIRECT LINK:* \n` +
    `${joinLink}\n\n` +
    `See you on the dashboard!`;

  const encodedMsg = encodeURIComponent(message);
  const waUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;

  window.open(waUrl, '_blank');
}
