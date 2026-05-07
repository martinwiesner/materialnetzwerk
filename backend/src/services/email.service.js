/**
 * Email Service — Brevo (formerly Sendinblue)
 * Sends notification emails when a user receives a new internal message.
 * Set BREVO_API_KEY in .env to enable. If missing, emails are silently skipped.
 */

let client = null;

async function getClient() {
  if (client) return client;
  const key = process.env.BREVO_API_KEY;
  if (!key) return null;

  let Brevo;
  try {
    Brevo = await import('@getbrevo/brevo');
  } catch {
    console.warn('[Brevo] Package @getbrevo/brevo not installed — emails disabled. Run: npm install');
    return null;
  }

  const apiInstance = new Brevo.TransactionalEmailsApi();
  apiInstance.authentications['api-key'].apiKey = key;
  client = apiInstance;
  return client;
}

/**
 * Send a "new message" notification email to the receiver.
 *
 * @param {object} opts
 * @param {string} opts.toEmail      - receiver email
 * @param {string} opts.toName       - receiver display name
 * @param {string} opts.senderName   - who sent the internal message
 * @param {string} opts.subject      - message subject (may be empty)
 * @param {string} opts.preview      - first ~100 chars of message content
 * @param {string} opts.appUrl       - base URL of the app (e.g. https://materialnetzwerk.de)
 */
export async function sendNewMessageEmail({ toEmail, toName, senderName, subject, preview, appUrl }) {
  const api = await getClient();
  if (!api) return; // BREVO_API_KEY not set or package missing — skip silently

  const fromEmail = process.env.BREVO_FROM_EMAIL || 'no-reply@materialnetzwerk.de';
  const fromName  = process.env.BREVO_FROM_NAME  || 'Materialnetzwerk';
  const messagesUrl = `${(appUrl || '').replace(/\/$/, '')}/messages`;

  const emailSubject = subject
    ? `Neue Nachricht: "${subject}" — von ${senderName}`
    : `Neue Nachricht von ${senderName}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0033FF;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">Materialnetzwerk</p>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">Materialien · Projekte · Akteure</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:15px;color:#111827;">Hallo ${toName},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;">
              du hast eine neue Nachricht von <strong>${senderName}</strong> erhalten.
            </p>

            ${preview ? `
            <div style="background:#f9fafb;border-left:3px solid #0033FF;border-radius:4px;padding:12px 16px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#6b7280;font-style:italic;">"${preview}${preview.length >= 100 ? '…' : ''}"</p>
            </div>` : ''}

            <a href="${messagesUrl}"
               style="display:inline-block;background:#0033FF;color:#ffffff;text-decoration:none;
                      padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
              Nachricht lesen →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Diese E-Mail wurde automatisch versendet. Du erhältst sie, weil du beim Materialnetzwerk registriert bist.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const sendSmtpEmail = {
    sender:      { name: fromName, email: fromEmail },
    to:          [{ email: toEmail, name: toName }],
    subject:     emailSubject,
    htmlContent,
  };

  try {
    await api.sendTransacEmail(sendSmtpEmail);
    console.log(`[Brevo] Email sent to ${toEmail}`);
  } catch (err) {
    // Log but never crash the main request
    const detail = err?.response?.body || err?.response?.text || err.message;
    console.error('[Brevo] Email error:', typeof detail === 'object' ? JSON.stringify(detail) : detail);
  }
}
