import { subjectName, topicName } from '../../lib/stats.js';

const LOCALE = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };
const loc = (lang) => LOCALE[lang] || 'en-GB';

export const displayName = (p) => p?.name || p?.email || String(p?.id || '').slice(0, 8);
export const initials = (p) => (displayName(p).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();

export const fmtDate = (d, lang) => (d ? new Date(d).toLocaleDateString(loc(lang), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const fmtDateTime = (d, lang) => (d ? new Date(d).toLocaleString(loc(lang), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtTime = (d, lang) => (d ? new Date(d).toLocaleTimeString(loc(lang), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');

export function fmtDuration(sec) {
  if (sec === null || sec === undefined || Number.isNaN(Number(sec))) return '—';
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function relTime(d, now, t) {
  if (!d) return t('tp_never');
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 10) return t('tp_just_now');
  if (s < 60) return t('tp_ago_s', { n: s });
  if (s < 3600) return t('tp_ago_m', { n: Math.round(s / 60) });
  if (s < 86400) return t('tp_ago_h', { n: Math.round(s / 3600) });
  return t('tp_ago_d', { n: Math.round(s / 86400) });
}

export const pctClass = (v) => (v === null || v === undefined ? '' : v >= 80 ? 'chip-ok' : v >= 55 ? 'chip-mid' : 'chip-bad');
export const testTitle = (a, lang, t) => `${subjectName(a.subject, lang)} · ${topicName(a.topic || 'all', lang, t('all_topics'))}`;
export const optText = (options, idx) => (Number.isInteger(idx) && Array.isArray(options) ? options[idx] ?? '' : '');
export const inRange = (iso, from, to) => {
  const x = new Date(iso).getTime();
  return (!from || x >= new Date(`${from}T00:00:00`).getTime()) && (!to || x <= new Date(`${to}T23:59:59`).getTime());
};
