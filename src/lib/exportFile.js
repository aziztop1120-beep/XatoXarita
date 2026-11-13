import { buildXlsx } from './xlsx.js';

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// CSV: UTF-8 BOM bilan (Excel'da o‘zbek harflari to‘g‘ri ochiladi)
export function downloadCsv(name, rows) {
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`; // CSV/formula injection'dan himoya
    return `"${s.replaceAll('"', '""')}"`;
  };
  save(new Blob([`\uFEFF${rows.map((r) => r.map(esc).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
}

export function downloadXlsx(name, sheets) {
  const safe = sheets.map((s) => ({
    ...s,
    rows: s.rows.map((r) => r.map((v) => (typeof v === 'string' && /^[=+\-@]/.test(v) && Number.isNaN(Number(v)) ? `'${v}` : v))),
  }));
  save(buildXlsx(safe), `${name}.xlsx`);
}

export const stamp = () => new Date().toISOString().slice(0, 10);
