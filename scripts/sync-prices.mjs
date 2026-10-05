const docsUrl = 'https://docs.google.com/document/d/e/2PACX-1vRYuEJAWCqb3TKXHiO24XBo3ip9PX4z1EiWissi8ccsM2WUBsueH-KuU3_BX3deaoEk3_XD1dxjX-Wn/pub?embedded=true';

const response = await fetch(`${docsUrl}&_cb=${Date.now()}`, { cache: 'no-store' });
if (!response.ok) throw new Error(`Google Docs respondió ${response.status}`);
const html = await response.text();

function plainText(value) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

const prices = {};
for (const [, rowHtml] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const cells = [...rowHtml.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(([, cell]) => plainText(cell));
  for (let i = 0; i < cells.length - 1; i++) {
    const product = cells[i];
    const match = cells[i + 1].match(/^\s*\$\s*([\d.,]+)/);
    if (!product || !match) continue;
    const price = Number(match[1].replace(/\D/g, ''));
    if (Number.isFinite(price)) prices[normalize(product)] = price;
  }
}

if (!Object.keys(prices).length) throw new Error('No se encontraron precios en el documento publicado');
await (await import('node:fs/promises')).writeFile('precios.json', `${JSON.stringify(prices, null, 2)}\n`);
console.log(`Se sincronizaron ${Object.keys(prices).length} precios.`);
