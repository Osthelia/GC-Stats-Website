/**
 * GC-Stats - notification-template
 *
 * Renders the shared plain inline-styled HTML/text email layout used by
 * in-app notification emails and account emails (verification, password
 * reset), so markup isn't duplicated across callers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Plain inline-styled HTML, no build-time template engine — same
 * minimal-dependency style as lib/openai-moderation.ts/lib/discord-webhook.ts.
 * Shared by lib/notify.ts (in-app notification emails) and the email
 * verification/password reset emails (actions/register.ts,
 * actions/password-reset.ts) rather than each keeping its own markup.
 */
export function renderNotificationEmail(title: string, body: string, link: string, cta = "View on GC-Stats"): { html: string; text: string } {
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#0e0e0e;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#161616;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:28px;">
          <div style="font-size:13px;font-weight:700;color:#e4ae22;letter-spacing:.02em;margin-bottom:16px;">GC-Stats</div>
          <h1 style="margin:0 0 10px;font-size:18px;color:#fafafa;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#b3b3b3;">${escapeHtml(body)}</p>
          <a href="${link}" style="display:inline-block;padding:11px 20px;border-radius:9px;background:#e4ae22;color:#0e0e0e;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(cta)}</a>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${title}\n\n${body}\n\n${link}`;

  return { html, text };
}
