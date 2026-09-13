import {
  GUIDED_STATUS,
  normalizeGuidedMapping,
} from './guided-multi-art.js';

const clean = (value, max = 600) => String(value || '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, max);

function normalizeRoutingText(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[：﹕]/g, ':')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\r\n?/g, '\n');
}

function targetIndex(value, artworkCount) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return null;
  const index = numeric - 1;
  const count = Math.max(0, Number(artworkCount) || 0);
  return !count || index < count ? index : null;
}

function parseIndexedLine(line, artworkCount) {
  const source = normalizeRoutingText(line).trim();
  if (!source) return null;
  const patterns = [
    /^(?:arte|artwork|pe[cç]a)\s*#?\s*0*(\d{1,3})\s*(?::|=|=>|->|→|-)\s*(.+)$/i,
    /^(?:arte|artwork|pe[cç]a)\s*#?\s*0*(\d{1,3})\s*[.)]\s*(.+)$/i,
    /^(?:arte|artwork|pe[cç]a)\s*#?\s*0*(\d{1,3})\s+(.+)$/i,
    /^#?\s*0*(\d{1,3})\s*(?::|=|=>|->|→|-)\s*(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const index = targetIndex(match[1], artworkCount);
    const destination = clean(match[2]);
    if (index == null || !destination) return null;
    return { index, destination };
  }
  return null;
}

function parseInlineTargets(raw, artworkCount, targets) {
  const source = normalizeRoutingText(raw);
  const marker = /(?:^|\n|;)\s*(?:arte|artwork|pe[cç]a)\s*#?\s*0*(\d{1,3})\s*(?::|=|=>|->|→|-)\s*([^\n;]+)/gim;
  let match;
  while ((match = marker.exec(source))) {
    const index = targetIndex(match[1], artworkCount);
    const destination = clean(match[2]);
    if (index != null && destination) targets.set(index, destination);
  }
}

export function parseArtworkTargetPlan(value = '', artworkCount = 0) {
  const raw = normalizeRoutingText(value).trim();
  const targets = new Map();
  const generalLines = [];
  if (!raw) return { targets, general: '', explicit: false };

  const lines = raw
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const parsed = parseIndexedLine(line, artworkCount);
    if (parsed) targets.set(parsed.index, parsed.destination);
    else generalLines.push(line);
  }

  // Recovery pass for copy/paste from rich text, mobile keyboards or punctuation
  // variants that may not survive line-by-line parsing exactly as typed.
  parseInlineTargets(raw, artworkCount, targets);

  const general = clean(generalLines
    .filter((line) => !parseIndexedLine(line, artworkCount))
    .join(' '), 600);

  return {
    targets,
    general,
    explicit: targets.size > 0,
  };
}

export function targetForArtwork(plan, artworkIndex, { useGeneral = false } = {}) {
  if (!plan || !(plan.targets instanceof Map)) return '';
  if (plan.targets.has(artworkIndex)) return clean(plan.targets.get(artworkIndex));
  return useGeneral ? clean(plan.general) : '';
}

export function summarizeArtworkTargetPlan(plan, artworkCount = 0) {
  const count = Math.max(0, Number(artworkCount) || 0);
  if (!plan?.explicit) return plan?.general ? `Próxima busca: ${plan.general}` : 'Destinos automáticos';
  const mapped = Array.from({ length: count }, (_, index) => plan.targets.has(index)).filter(Boolean).length;
  return `${mapped}/${count} arte(s) com destino explícito`;
}

export function removeArtworkFromMapping(mapping = [], artworkIndex) {
  const removed = Number(artworkIndex);
  if (!Number.isInteger(removed) || removed < 0) return normalizeGuidedMapping(mapping);
  return normalizeGuidedMapping(mapping).map((slot) => {
    if (slot.artworkIndex == null) return slot;
    if (slot.artworkIndex === removed) {
      return {
        ...slot,
        artworkIndex: null,
        guidedStatus: GUIDED_STATUS.AVAILABLE,
        frozen: false,
        integrationPlan: null,
      };
    }
    if (slot.artworkIndex > removed) return { ...slot, artworkIndex: slot.artworkIndex - 1 };
    return slot;
  });
}

export function markArtworkReplaced(mapping = [], artworkIndex) {
  const replaced = Number(artworkIndex);
  if (!Number.isInteger(replaced) || replaced < 0) return normalizeGuidedMapping(mapping);
  return normalizeGuidedMapping(mapping).map((slot) => {
    if (slot.artworkIndex !== replaced) return slot;
    return {
      ...slot,
      guidedStatus: GUIDED_STATUS.PREVIEW,
      frozen: false,
      integrationPlan: null,
    };
  });
}
