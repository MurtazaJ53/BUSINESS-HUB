/**
 * Elite Mail Utility
 * Powered by Resend.com
 * Handles automated onboarding emails for staff.
 */

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;

export async function sendStaffInvite({
  to,
  staffName,
  inviteCode,
  shopName,
}: {
  to: string;
  staffName: string;
  inviteCode: string;
  shopName: string;
}) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is missing from .env');
    return { success: false, error: 'Mail server configuration missing.' };
  }

  const joinLink = `${window.location.origin}/?invite=${inviteCode}`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Business Hub <onboarding@resend.dev>',
        to: [to],
        subject: `Welcome to ${shopName} - Team Invitation`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
            <h1 style="color: #0066ff; letter-spacing: -1px;">Welcome aboard, ${staffName}!</h1>
            <p>You have been invited to join the <strong>${shopName}</strong> staff team on Business Hub Pro.</p>
            
            <div style="background: #f4f4f4; padding: 20px; border-radius: 12px; margin: 20px 0;">
              <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #666;">Your Invitation Code</p>
              <h2 style="margin: 10px 0 0 0; font-size: 32px; letter-spacing: 4px; color: #000;">${inviteCode}</h2>
            </div>

            <h3>How to Join:</h3>
            <p><strong>Option A: For Web Users</strong><br/>
            Click the link below to join instantly. The code will be automatically applied:<br/>
            <a href="${joinLink}" style="display: inline-block; background: #0066ff; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;">Join Team Instantly</a></p>

            <p><strong>Option B: For Android App Users</strong><br/>
            1. Open the Business Hub APK.<br/>
            2. Go to "Join Team" mode.<br/>
            3. Paste your invitation code: <strong>${inviteCode}</strong></p>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999;">Sent via Business Hub Pro Automated Onboarding.</p>
          </div>
        `,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data };
    } else {
      console.error('Resend API Error:', data);
      return { success: false, error: data.message || 'Failed to send email.' };
    }
  } catch (error: any) {
    console.error('Mail Transmission Error:', error);
    return { success: false, error: 'Network error while sending email.' };
  }
}
