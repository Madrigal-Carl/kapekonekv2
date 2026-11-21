import { escapeHtml } from '../../utils/escapeHtml.js';

// Email clients need inline hex colors; these mirror the @theme tokens in frontend/src/index.css.
const C = {
  espresso: '#2B1A12',
  caramelLight: '#EBC98F',
  roast: '#7B4A2A',
  crema: '#F7EFE4',
  sand: '#E7DCCD',
  ink2: '#4A3A30',
  ink4: '#7A6A5E',
};
const FONT = `'Poppins', 'Segoe UI', Arial, sans-serif`;

/**
 * Wrap email content in the KapeKonek coffee layout.
 * `paragraphs` are plain text and get escaped here; `cta.url` must be an app URL.
 * @param {{ preheader?: string, heading: string, paragraphs: string[], cta?: { label: string, url: string }, footnote?: string }} content
 * @returns {{ html: string, text: string }}
 */
export function renderLayout({ preheader = '', heading, paragraphs, cta, footnote }) {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${C.ink2}">${escapeHtml(p)}</p>`)
    .join('');
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${C.roast};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:5px">${escapeHtml(cta.label)}</a></p>`
    : '';
  const note = footnote
    ? `<p style="margin:16px 0 0;font-size:12.5px;line-height:1.6;color:${C.ink4}">${escapeHtml(footnote)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${C.crema};font-family:${FONT}">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.crema};padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${C.sand};border-radius:8px;overflow:hidden">
<tr><td style="background:${C.espresso};padding:20px 28px;color:${C.caramelLight};font-size:18px;font-weight:600">KapeKonek</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:500;color:${C.espresso}">${escapeHtml(heading)}</h1>
${body}${button}${note}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid ${C.sand};font-size:12px;color:${C.ink4}">Kaluppa · Pantayin, Santa Cruz, Marinduque. This is an automated email.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    heading,
    '',
    ...paragraphs.flatMap((p) => [p, '']),
    ...(cta ? [`${cta.label}: ${cta.url}`, ''] : []),
    ...(footnote ? [footnote, ''] : []),
    '— KapeKonek',
  ].join('\n');

  return { html, text };
}
