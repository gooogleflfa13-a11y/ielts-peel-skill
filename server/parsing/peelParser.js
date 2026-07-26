/**
 * Structural PEEL parser — scans [P]/[E1]/[E2]/[L] markers in document order.
 */
export function parsePeelOutput(text) {
  const raw = typeof text === 'string' ? text : '';
  const metaMatch = raw.match(/底层逻辑[：:]\s*(.+)/);
  const modelMatch = raw.match(/Model\s*([ABC])\s*[:：]\s*(.+)/i);
  const metadata = {
    meta: metaMatch ? metaMatch[1].trim() : null,
    model: modelMatch
      ? { id: modelMatch[1].toUpperCase(), label: modelMatch[2].trim() }
      : null,
    raw,
  };

  const fail = (issues) => ({
    ok: false,
    code: 'INVALID_PEEL_STRUCTURE',
    issues,
    peels: [],
    ...metadata,
  });

  if (!raw.trim()) {
    return fail([
      {
        code: 'NO_PEEL',
        evidence: '',
        action: 'Provide one complete [P][E1][E2][L] unit.',
      },
    ]);
  }

  const allMarkerRe = /\[([^\]\r\n]*)\]/g;
  const markers = [];
  let match;
  while ((match = allMarkerRe.exec(raw)) !== null) {
    markers.push({
      label: match[1].toUpperCase(),
      rawLabel: match[1],
      start: match.index,
      bodyStart: allMarkerRe.lastIndex,
    });
  }

  const allowed = new Set(['P', 'E1', 'E2', 'L']);
  const unknown = markers.filter((marker) => !allowed.has(marker.label));
  if (unknown.length) {
    return fail(
      unknown.map((marker) => ({
        code: 'UNKNOWN_LABEL',
        evidence: `[${marker.rawLabel}]`,
        action: 'Remove labels other than [P], [E1], [E2], and [L].',
      }))
    );
  }

  if (!markers.length) {
    return fail([
      {
        code: 'NO_PEEL',
        evidence: raw.slice(0, 120),
        action: 'Provide one complete [P][E1][E2][L] unit.',
      },
    ]);
  }

  const labels = markers.map((marker) => marker.label);
  const issues = [];
  const unitCount = labels.filter((label) => label === 'P').length;
  for (const label of allowed) {
    const count = labels.filter((candidate) => candidate === label).length;
    if (count > unitCount) {
      issues.push({
        code: 'DUPLICATE_LABEL',
        layer: label,
        evidence: `${count} [${label}] labels for ${unitCount} PEEL unit(s)`,
        action: `Use [${label}] exactly once per PEEL unit.`,
      });
    } else if (count < unitCount) {
      issues.push({
        code: 'MISSING_LABEL',
        layer: label,
        evidence: `${count} [${label}] labels for ${unitCount} PEEL unit(s)`,
        action: `Add one [${label}] to every PEEL unit.`,
      });
    }
  }

  const expected = ['P', 'E1', 'E2', 'L'];
  labels.forEach((label, index) => {
    if (label !== expected[index % expected.length]) {
      issues.push({
        code: 'LABEL_ORDER',
        layer: label,
        evidence: `[${label}] at marker ${index + 1}`,
        action: 'Use labels only in repeated [P][E1][E2][L] order.',
      });
    }
  });
  if (labels.length % expected.length !== 0) {
    issues.push({
      code: 'MISSING_LABEL',
      evidence: `Incomplete marker sequence: ${labels.map((label) => `[${label}]`).join(' ')}`,
      action: 'Complete every PEEL unit with [P][E1][E2][L].',
    });
  }
  if (issues.length) return fail(issues);

  const trimMetadata = (body) => {
    const lines = body.replace(/^\s*\n?/, '').split(/\n/);
    const boundary = lines.findIndex((line) =>
      /^\s*(?:---|\||#{1,6}\s|底层逻辑[：:]|Model\s*[ABC]\s*[:：]|逻辑同构|横向秒杀)/i.test(
        line
      )
    );
    return lines
      .slice(0, boundary === -1 ? lines.length : boundary)
      .join(' ')
      .trim();
  };

  const peels = [];
  for (let index = 0; index < markers.length; index += expected.length) {
    const peel = {};
    for (let offset = 0; offset < expected.length; offset++) {
      const marker = markers[index + offset];
      const next = markers[index + offset + 1];
      peel[marker.label] = trimMetadata(
        raw.slice(marker.bodyStart, next?.start ?? raw.length)
      );
    }
    const emptyLayers = expected.filter((label) => !peel[label]);
    if (emptyLayers.length) {
      return fail(
        emptyLayers.map((label) => ({
          code: 'EMPTY_LAYER',
          layer: label,
          evidence: `[${label}] has no content`,
          action: `Write one sentence after [${label}].`,
        }))
      );
    }
    peels.push(peel);
  }

  return {
    ok: true,
    peels,
    issues: [],
    code: null,
    ...metadata,
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
