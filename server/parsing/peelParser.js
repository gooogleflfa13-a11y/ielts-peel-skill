/**
 * Structural PEEL parser — scans [P]/[E1]/[E2]/[L] markers in document order.
 */
export function parsePeelOutput(text) {
  if (!text) return { peels: [], meta: null, model: null, raw: '' };

  const peels = [];
  const markerRe = /\[(P|E1|E2|L)\]\s*([\s\S]*?)(?=\s*\[(P|E1|E2|L)\]|$)/gi;

  let m;
  let current = null;
  while ((m = markerRe.exec(text)) !== null) {
    const label = m[1];
    const body = m[2]
      .replace(/^\s*\n/, '')
      .replace(/\s+$/, '')
      .replace(/\n\s*---[\s\S]*$/, '')
      .trim();

    if (label === 'P') {
      if (current) peels.push(current);
      current = { P: body, E1: '', E2: '', L: '' };
    } else if (current) {
      current[label] = body.split('\n')[0]?.trim() === body
        ? body
        : body.replace(/\n+---[\s\S]*$/, '').trim();
    }
  }
  if (current) peels.push(current);

  // Clean L lines that swallowed trailing meta
  for (const peel of peels) {
    if (peel.L) {
      peel.L = peel.L
        .split(/\n/)
        .filter((line) => !/底层逻辑|命中模型|横向秒杀/.test(line))
        .join(' ')
        .trim();
    }
  }

  const metaMatch = text.match(/底层逻辑[：:]\s*(.+)/);
  const modelMatch = text.match(/Model\s*([ABC])\s*[:：]\s*(.+)/i);

  return {
    peels,
    meta: metaMatch ? metaMatch[1].trim() : null,
    model: modelMatch
      ? { id: modelMatch[1].toUpperCase(), label: modelMatch[2].trim() }
      : null,
    raw: text,
  };
}

/**
 * Fallback: unlabeled multi-line PEEL (3–5 lines → P/E1/E2/L)
 */
export function parseLooseLines(input) {
  const lines = (input || '')
    .split(/\n/)
    .map((l) => l.replace(/^\[(P|E1|E2|L)\]\s*/i, '').trim())
    .filter(Boolean);
  if (lines.length < 3 || lines.length > 6) return null;
  return {
    P: lines[0] || '',
    E1: lines[1] || '',
    E2: lines[2] || '',
    L: lines[3] || lines[lines.length - 1] || '',
  };
}
