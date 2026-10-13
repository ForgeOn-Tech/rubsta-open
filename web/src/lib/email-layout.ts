/** Table layout and inline styles keep the email usable in common mail clients. */
export function escapeEmailText(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function paragraph(text: string) {
  return `<p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#33483b;">${escapeEmailText(text).replace(/\n/g, "<br>")}</p>`;
}

function button(label: string, url: string, secondary = false) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;"><tr><td bgcolor="${secondary ? "#eef0e6" : "#203d2e"}" style="border-radius:6px;border:1px solid #203d2e;text-align:center;"><a href="${url}" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;font-weight:bold;text-decoration:none;color:${secondary ? "#203d2e" : "#ffffff"};">${label}</a></td></tr></table>`;
}

function renderBlock(block: string): string {
  if (block.startsWith("Open your player account: ")) return button("Open player account", "https://www.rubstaopen.com/home");
  if (block.startsWith("Don’t forget to create your tennis avatar")) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;border-top:1px solid #dce2d8;"><tr><td style="padding-top:24px;">
      <h2 style="margin:0 0 10px;font-family:Georgia,serif;font-size:23px;line-height:30px;font-weight:normal;color:#203d2e;">Bring your court-side character.</h2>
      ${paragraph("Don’t forget to create your tennis avatar and share it with your friends!")}
      ${button("Create your avatar", "https://www.rubstaopen.com/avatar", true)}
    </td></tr></table>`;
  }
  if (/^(Your registered event\(s\)|Event\(s\)):/u.test(block)) {
    const rows = block.split("\n").map(line => {
      const split = line.indexOf(":");
      return `<tr><td style="padding:8px 16px;font-family:Arial,Helvetica,sans-serif;word-break:break-word;">
        <div style="font-size:11px;line-height:18px;font-weight:bold;letter-spacing:0.7px;text-transform:uppercase;color:#667369;">${escapeEmailText(line.slice(0, split))}</div>
        <div style="font-size:15px;line-height:24px;color:#203d2e;overflow-wrap:anywhere;">${escapeEmailText(line.slice(split + 1).trim())}</div>
      </td></tr>`;
    }).join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4ed" style="margin:4px 0 24px;border:1px solid #dce2d8;border-radius:6px;"><tr><td height="8"></td></tr>${rows}<tr><td height="8"></td></tr></table>`;
  }
  if (block.startsWith("Questions? Reply to this email")) {
    return `<p style="margin:0 0 24px;font-size:14px;line-height:24px;color:#667369;">Questions? Reply to this email or contact<br><strong style="color:#203d2e;">Manvir Singh</strong> · <a href="tel:+919769009034" style="color:#203d2e;text-decoration:underline;">+91 97690 09034</a><br>We’re happy to help.</p>`;
  }
  return paragraph(block);
}

export function registrationEmailHtml(email: { subject: string; body: string }): string {
  const welcome = email.subject.startsWith("We’re looking forward");
  const heading = welcome ? "See you on court."
    : email.subject.includes("needs review") ? "Let’s check your entry."
    : email.subject.startsWith("Registration confirmed") ? "You’re registered."
    : "Payment confirmed.";
  const preheader = welcome ? "Your entry is saved. We look forward to welcoming you to Rubsta Open."
    : email.subject.includes("needs review") ? "Payment received. Please contact us so we can review your entry."
    : "Your payment details and next steps for Rubsta Open.";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeEmailText(email.subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f1e8;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeEmailText(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f1e8"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;" bgcolor="#ffffff">
<tr><td bgcolor="#203d2e" style="padding:28px 24px;"><p style="margin:0;font-family:Georgia,serif;font-size:30px;line-height:38px;color:#ffffff;">Rubsta Open</p><p style="margin:8px 0 0;font-size:10px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:#dce5d8;">Tournament updates</p></td></tr>
<tr><td style="padding:32px 24px 12px;word-break:break-word;">
<p style="margin:0 0 10px;font-size:11px;line-height:18px;letter-spacing:1.5px;text-transform:uppercase;color:#667369;">${welcome ? "A note for our players" : "Your tournament entry"}</p>
<h1 style="margin:0 0 28px;font-family:Georgia,serif;font-size:34px;line-height:42px;font-weight:normal;color:#203d2e;">${heading}</h1>
${email.body.split("\n\n").map(renderBlock).join("\n")}
</td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #e6e9e1;font-size:12px;line-height:20px;color:#667369;">Rubsta Open · Powered by ForgeLabs<br><a href="mailto:info@rubstaopen.com" style="color:#526456;text-decoration:underline;">info@rubstaopen.com</a></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
