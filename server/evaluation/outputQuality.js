import { parsePeelOutput } from '../parsing/peelParser.js';
import { validatePeels } from './validator.js';

const QUALITY_MESSAGE = 'Generated output failed the PEEL quality contract.';

function mergeUsage(first, second) {
  if (!first) return second || null;
  if (!second) return first;
  return {
    prompt_tokens: (first.prompt_tokens || 0) + (second.prompt_tokens || 0),
    completion_tokens:
      (first.completion_tokens || 0) + (second.completion_tokens || 0),
    total_tokens: (first.total_tokens || 0) + (second.total_tokens || 0),
  };
}

function countIssue(actual, minPeels, maxPeels) {
  const expected = minPeels === maxPeels ? `${minPeels}` : `${minPeels}-${maxPeels}`;
  return {
    layer: null,
    code: 'PEEL_COUNT',
    evidence: `${actual} PEEL unit(s) found; expected ${expected}`,
    action: `Return ${expected} complete PEEL unit(s).`,
  };
}

export function evaluatePeelOutput(
  content,
  { minPeels = 1, maxPeels = minPeels, extraIssues = () => [] } = {}
) {
  const parsed = parsePeelOutput(content);
  const validation = parsed.ok
    ? validatePeels(parsed.peels)
    : {
        passed: false,
        checks: {
          labels: 'fail',
          layerBoundaries: 'fail',
          e2Concreteness: 'fail',
          linkClosure: 'fail',
          bannedGlue: 'fail',
        },
        issues: parsed.issues,
        details: [],
        summary: { structure: 0, layers: 0, physical: 0, totalWarnings: parsed.issues.length },
        allWarnings: parsed.issues.map((issue) => issue.code),
      };
  const issues = [...(parsed.ok ? validation.issues : parsed.issues)];

  if (parsed.ok && (parsed.peels.length < minPeels || parsed.peels.length > maxPeels)) {
    issues.push(countIssue(parsed.peels.length, minPeels, maxPeels));
  }
  issues.push(...extraIssues(content, parsed));

  return {
    passed: parsed.ok && validation.passed && issues.length === 0,
    parsed,
    validation: { ...validation, passed: validation.passed && issues.length === 0 },
    issues,
  };
}

export function evaluateWizardQuestions(content) {
  const text = typeof content === 'string' ? content.trim() : '';
  const containsPeel = /\[(?:P|E1|E2|L)\]/i.test(text);
  const lines = text
    .split(/\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  const questions = lines.filter((line) => /[?？]\s*$/.test(line));
  const nonQuestions = lines.filter((line) => !/[?？]\s*$/.test(line));
  const issues = [];
  if (containsPeel || nonQuestions.length > 0) {
    issues.push({
      layer: null,
      code: 'WIZARD_QUESTIONS_ONLY',
      evidence: containsPeel
        ? 'PEEL labels were emitted before the learner answered.'
        : `Non-question text: ${nonQuestions[0]}`,
      action: 'Ask questions only, with no preamble or scripts, on the first wizard turn.',
    });
  }
  if (questions.length < 3 || questions.length > 4) {
    issues.push({
      layer: null,
      code: 'WIZARD_QUESTION_COUNT',
      evidence: `${questions.length} concrete question(s) found; expected 3-4`,
      action: 'Ask exactly 3-4 concrete life-detail questions.',
    });
  }

  return {
    passed: issues.length === 0,
    parsed: { ok: issues.length === 0, peels: [], issues, code: issues.length ? 'INVALID_WIZARD' : null, raw: text },
    validation: {
      passed: issues.length === 0,
      checks: {},
      issues,
      details: [],
      summary: { structure: 0, layers: 0, physical: 0, totalWarnings: issues.length },
      allWarnings: issues.map((issue) => issue.code),
    },
    issues,
  };
}

function markdownSection(content, headingPattern) {
  const lines = (content || '').split(/\n/);
  const headingIndex = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (headingIndex === -1) return null;
  const body = [];
  for (let index = headingIndex + 1; index < lines.length; index++) {
    if (/^##\s+/.test(lines[index].trim())) break;
    body.push(lines[index]);
  }
  return body.join('\n').trim();
}

function hasCompletePeel(text) {
  return /\[P\][\s\S]+\[E1\][\s\S]+\[E2\][\s\S]+\[L\][\s\S]+/i.test(text || '');
}

export function matrixContractIssues(content) {
  const text = content || '';
  const issues = [];
  const model = markdownSection(text, /^##\s*命中模型\s*$/u);
  if (!model || !/\bModel\s*[ABC]\s*[:：]/i.test(model)) {
    issues.push({
      layer: null,
      code: 'MATRIX_MODEL',
      evidence: 'A Model A/B/C selection was not found under 命中模型.',
      action: 'Add 命中模型 with one explicit Model A, B, or C selection.',
    });
  }

  const skeleton = markdownSection(text, /^##\s*底层骨架(?:\s*\([^)]*\))?\s*$/u);
  if (!skeleton || !/^\s*[-*]\s+\S/m.test(skeleton)) {
    issues.push({
      layer: null,
      code: 'MATRIX_SKELETON',
      evidence: '底层骨架 is missing or contains no bullet.',
      action: 'Add a 底层骨架 section with at least one mechanism bullet.',
    });
  }

  const baseline = markdownSection(text, /^##\s*基准\s*PEEL(?:（[^）]*）|\([^)]*\))?\s*$/iu);
  if (!baseline || !hasCompletePeel(baseline)) {
    issues.push({
      layer: null,
      code: 'MATRIX_BASELINE',
      evidence: '基准 PEEL is missing or incomplete.',
      action: 'Add one complete PEEL block under 基准 PEEL.',
    });
  }

  const questionMatches = [...text.matchAll(/^###\s*题([123])\s*[:：][^\n]*$/gmu)];
  const questionNumbers = questionMatches.map((match) => match[1]).join('');
  const questionsComplete = questionMatches.every((match, index) => {
    const start = match.index + match[0].length;
    const end = questionMatches[index + 1]?.index ?? text.search(/^##\s*逻辑同构说明/m);
    return hasCompletePeel(text.slice(start, end === -1 ? text.length : end));
  });
  if (questionNumbers !== '123' || !questionsComplete) {
    issues.push({
      layer: null,
      code: 'MATRIX_QUESTION_SECTIONS',
      evidence: `Question sections found: ${questionNumbers || 'none'}.`,
      action: 'Add 题1, 题2, and 题3 sections, each with one complete PEEL block.',
    });
  }

  const isomorphism = markdownSection(text, /^##\s*逻辑同构说明\s*$/u);
  if (!isomorphism) {
    issues.push({
      layer: null,
      code: 'MATRIX_LOGIC_ISOMORPHISM',
      evidence: '逻辑同构说明 is missing or empty.',
      action: 'Add a non-empty 逻辑同构说明 section after the question sections.',
    });
  }

  return issues;
}

export function wizardScriptIssues(content) {
  const tableLines = (content || '')
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));
  const cells = (line) => line.slice(1, -1).split('|').map((cell) => cell.trim());
  const expectedColumns = ['用户细节关键词', '命中母题', '推荐节点', '可横向秒杀的题型举例'];
  const headerIndex = tableLines.findIndex((line) => cells(line)[0] === expectedColumns[0]);
  if (headerIndex === -1) {
    return [
      {
        layer: null,
        code: 'WIZARD_ROUTING_TABLE',
        evidence: 'Required wizard routing table was not found.',
        action: 'Add the four-column 题库路由映射表 after the scripts.',
      },
    ];
  }

  const issues = [];
  const header = cells(tableLines[headerIndex]);
  if (
    header.length !== expectedColumns.length ||
    header.some((column, index) => column !== expectedColumns[index])
  ) {
    issues.push({
      layer: null,
      code: 'WIZARD_ROUTING_COLUMNS',
      evidence: `Routing columns: ${header.join(' | ')}`,
      action: `Use exactly these columns: ${expectedColumns.join(' | ')}.`,
    });
  }

  const separator = tableLines[headerIndex + 1]
    ? cells(tableLines[headerIndex + 1])
    : [];
  const rows = tableLines.slice(headerIndex + 2).map(cells);
  const hasSeparator =
    separator.length === expectedColumns.length &&
    separator.every((cell) => /^:?-{3,}:?$/.test(cell));
  const hasMappingRow = rows.some(
    (row) => row.length === expectedColumns.length && row.every(Boolean)
  );
  if (!hasSeparator || !hasMappingRow) {
    issues.push({
      layer: null,
      code: 'WIZARD_ROUTING_ROW',
      evidence: 'Routing table has no complete mapping row after its separator.',
      action: 'Add at least one non-empty four-column mapping row.',
    });
  }
  return issues;
}

export function buildRepairInstruction(issues) {
  const issueLines = issues.map(
    (issue, index) =>
      `${index + 1}. ${issue.code}${issue.layer ? ` [${issue.layer}]` : ''}: ${issue.action}`
  );
  return `Your previous output failed these structural checks:\n${issueLines.join(
    '\n'
  )}\n\nREGENERATE ONCE. Fix every issue and follow the command output contract exactly.`;
}

export async function finalizeGeneratedOutput({ content, usage, evaluate, repair }) {
  let finalContent = typeof content === 'string' ? content : '';
  let totalUsage = usage || null;
  let evaluation = evaluate(finalContent);
  let retries = 0;

  if (!evaluation.passed) {
    retries = 1;
    const corrected = await repair({ content: finalContent, issues: evaluation.issues });
    finalContent = typeof corrected?.content === 'string' ? corrected.content : '';
    totalUsage = mergeUsage(totalUsage, corrected?.usage);
    evaluation = evaluate(finalContent);
    if (!evaluation.passed) {
      return {
        ok: false,
        status: 'quality_failed',
        code: 'QUALITY_FAILED',
        message: QUALITY_MESSAGE,
        content: null,
        parsed: evaluation.parsed,
        validation: evaluation.validation,
        issues: evaluation.issues,
        usage: totalUsage,
        retries,
      };
    }
  }

  return {
    ok: true,
    status: 'success',
    code: null,
    content: finalContent,
    parsed: evaluation.parsed,
    validation: evaluation.validation,
    issues: [],
    usage: totalUsage,
    retries,
  };
}

export function createQualityError(result) {
  return Object.assign(new Error(result.message || QUALITY_MESSAGE), {
    code: 'QUALITY_FAILED',
    status: 422,
    retryable: false,
    issues: result.issues || [],
  });
}
