export type FirstWaveWelcomeProps = {
  displayName: string;
  membershipTag: string;
  hubSignupUrl: string;
};

export function firstWaveWelcomeSubject(tag: string) {
  return `${tag} — you're in the First Wave`;
}

export function firstWaveWelcomeText(props: FirstWaveWelcomeProps) {
  const { displayName, membershipTag, hubSignupUrl } = props;
  return `Dear ${displayName},

You have arrived.
Online. On the line. On Center Beach.

Your First Wave number is ${membershipTag} — one of the first hundred on the roll. That number is yours to keep: permanent recognition in Association records, the First Wave Roll, and your Member Hub profile. It is not ownership in the Association, a seat on the Board, or a right you can sell or pass on.

Your $100 entrance goes toward your welcome membership package — numbered coin, presentation box, and shirt — plus Hub access. The physical kit ships when it's produced and ready.

Create your Member Hub account so we can connect your roster record, your tag, and your profile in one place:

${hubSignupUrl}

With appreciation,

YAT-YAS Association, Inc.
The Board of Directors
`;
}

/** Transactional HTML letter — table layout for email clients. */
export function firstWaveWelcomeHtml(props: FirstWaveWelcomeProps) {
  const { displayName, membershipTag, hubSignupUrl } = props;
  const safeName = escapeHtml(displayName);
  const safeTag = escapeHtml(membershipTag);
  const safeUrl = escapeHtml(hubSignupUrl);
  const crest =
    "https://yatyasassociation.com/assets/crest-transparent.png";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${safeTag} — First Wave</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Georgia, serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#2a2620;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    You have arrived — online, on the line, on Center Beach. Create your Member Hub account.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#2a2620;background-image:linear-gradient(180deg,#1f1c18 0%,#3f4633 55%,#2a2620 100%);">
    <tr>
      <td align="center" style="padding:28px 16px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:18px;">
              <img src="${crest}" width="72" height="84" alt="YAT-YAS Association crest" style="display:block;border:0;height:84px;width:auto;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:22px;font-family:Georgia,'Times New Roman',serif;color:#c9a85a;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">
              YAT-YAS Association
            </td>
          </tr>
          <tr>
            <td style="background-color:#f3ead4;border:1px solid #b08d3e;border-radius:4px;box-shadow:0 12px 40px rgba(0,0,0,0.35);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:6px;background:linear-gradient(90deg,#3f4633 0%,#b08d3e 50%,#3f4633 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:36px 32px 12px;text-align:center;">
                    <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#5a6348;">
                      First Wave
                    </p>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:42px;line-height:1.05;font-weight:700;color:#1f1c18;letter-spacing:0.04em;">
                      ${safeTag}
                    </p>
                    <p style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-style:italic;line-height:1.45;color:#4a4338;">
                      You have arrived.<br />
                      Online. On the line. On Center Beach.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:8px 32px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="width:48px;height:1px;background-color:#b08d3e;font-size:0;line-height:0;">&nbsp;</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#2a2620;">
                    <p style="margin:0 0 16px;">Dear ${safeName},</p>
                    <p style="margin:0 0 6px;">You have arrived.</p>
                    <p style="margin:0 0 16px;font-style:italic;color:#3f4633;">
                      Online. On the line. On Center Beach.
                    </p>
                    <p style="margin:0 0 16px;">
                      Your First Wave number is <strong style="color:#3f4633;">${safeTag}</strong> — one of the first hundred on the roll. That number is yours to keep: permanent recognition in Association records, the First Wave Roll, and your Member Hub profile. It is not ownership in the Association, a seat on the Board, or a right you can sell or pass on.
                    </p>
                    <p style="margin:0 0 16px;">
                      Your $100 entrance goes toward your welcome membership package — numbered coin, presentation box, and shirt — plus Hub access. The physical kit ships when it's produced and ready.
                    </p>
                    <p style="margin:0 0 24px;">
                      Create your Member Hub account so we can connect your roster record, your tag, and your profile in one place.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 32px 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#3f4633" style="border-radius:4px;background-color:#3f4633;">
                          <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:700;color:#e8dfc8;text-decoration:none;letter-spacing:0.04em;">
                            Create your Member Hub account
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:1.45;color:#4a4338;">
                      Or open this link:<br />
                      <a href="${safeUrl}" style="color:#5a6348;word-break:break-all;">${safeUrl}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 36px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.55;color:#2a2620;">
                    <p style="margin:0 0 4px;">With appreciation,</p>
                    <p style="margin:0;font-weight:700;color:#1f1c18;">YAT-YAS Association, Inc.</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#4a4338;">The Board of Directors</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:11px;line-height:1.5;color:#c9a85a;">
              yatyasassociation.com · Member Hub<br />
              Independent of the U.S. Marine Corps, Navy, and Department of Defense.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
