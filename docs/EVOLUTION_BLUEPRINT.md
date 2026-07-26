# IELTS PEEL Hacker 进化蓝图：完整技术手册

> Status: Historical
>
> This pre-Phase 0 architecture proposal is retained for decision history only. Its AI examiner, semantic scoring, numeric score, and request-controlled provider examples are obsolete and must not be treated as the current product contract. The current `/score` capability is deterministic **PEEL Structure Review** only; see the approved Phase 0 design and implementation plan under `docs/superpowers/`.

> 从 Prompt Wrapper 到 Production-Grade Agentic System

---

## 目录

1. [当前架构诊断](#1-当前架构诊断)
2. [目标架构全景图](#2-目标架构全景图)
3. [阶段一：防御层（P0 立即可做）](#3-阶段一防御层-p0)
4. [阶段二：知识结构化（P1）](#4-阶段二知识结构化-p1)
5. [阶段三：编排器 + 评估器（P1）](#5-阶段三编排器--评估器-p1)
6. [阶段四：记忆与教练系统（P2）](#6-阶段四记忆与教练系统-p2)
7. [阶段五：前端进化（P2）](#7-阶段五前端进化-p2)
8. [阶段六：测试与 CI/CD](#8-阶段六测试与-cicd)
9. [阶段七：部署与可观测性](#9-阶段七部署与可观测性)
10. [完整文件规划](#10-完整文件规划)
11. [实施路线图](#11-实施路线图)

---

## 1. 当前架构诊断

```
当前数据流：

Client → Express (server/index.js) → OpenAI API → 正则解析 (parsePeelOutput) → Client
                                    ↑
                              systemPrompt.js (365 行, ~8000 tokens)
```

### 核心问题

| 问题 | 严重程度 | 具体表现 |
|------|---------|---------|
| **全量 Prompt 注入** | 🔴 | 每次调用注入完整 9 母题词库 (~8000 tokens)，无论题目只需 1 个母题 |
| **无程序化校验** | 🔴 | LLM 输出不经过任何质量检查，E2 可能无物理实体、P 和 E1 可能混用词汇 |
| **Server 是裸转发** | 🟡 | Express 除了拼接 Prompt 前缀外无任何自有逻辑，全部智力压在 LLM 侧 |
| **无错误恢复** | 🟡 | LLM 返回格式错误时无重试、无降级、无修复 |
| **知识硬编码** | 🟡 | 9 母题的节点定义、词汇库、E2 实体全部写死在字符串中，无法独立维护 |
| **无用户记忆** | 🟢 | Wizard 收集的用户细节会话结束即丢弃，下次无法复用 |
| **无质量度量** | 🟢 | 没有任何机制衡量 PEEL 输出的质量，用户无法知道哪一层薄弱 |
| **前端仅展示** | 🟢 | ResultPanel 只做美化渲染，不做交互式反馈、编辑、对比 |
| **无测试** | ⚪ | 零单元测试、零集成测试、零回归测试 |
| **无观测** | ⚪ | 无结构化日志、无指标暴露、无链路追踪 |

---

## 2. 目标架构全景图

```
                               ┌─────────────────────┐
                               │     React Client     │
                               │  (API Key / 指令面板  │
                               │   结构化渲染 / 编辑)  │
                               └──────────┬──────────┘
                                          │ POST /api/generate
                                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Server 🧠                                   │
│                                                                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │  index.js    │──▶│ orchestrator │──▶│   Skill Registry      │  │
│  │ (薄适配层)   │   │    .js       │   │  /peel /matrix /wizard │  │
│  └──────────────┘   └──────┬───────┘   └──────────┬───────────┘  │
│                            │                        │              │
│               ┌────────────┼────────────┐          │              │
│               ▼            ▼            ▼          ▼              │
│       ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│       │  Topic   │ │  Prompt  │ │ Evaluator│ │  Memory  │       │
│       │ Retriever│ │ Builder  │ │ (质检器) │ │ (用户记忆)│       │
│       └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│            │            │            │            │               │
│            ▼            │            │            │               │
│  ┌────────────────┐     │            │            │               │
│  │ Knowledge Base │     │            │            │               │
│  │ 9 topics/*.json│◀────┘            │            │               │
│  └────────────────┘                  │            │               │
│                                      ▼            ▼               │
│                              ┌──────────────────────────┐        │
│                              │       LLM Client          │        │
│                              │  (统一调用 / 重试 / 流式) │        │
│                              └──────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 阶段一：防御层（P0）

> **目标**：不改架构的前提下，加校验、瘦身 Prompt，让现有系统至少不输出坏结果。

### 3.1 输出后校验器 `server/evaluation/validator.js`

```javascript
// ============================================================
// server/evaluation/validator.js
// ============================================================

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2_BANK = JSON.parse(readFileSync(join(__dirname, '../knowledge/e2-entities.json'), 'utf-8'));

// 所有 E2 实体词的小写集合
const ALL_E2_TERMS = new Set();
for (const topic of Object.values(E2_BANK)) {
  for (const arr of Object.values(topic)) {
    for (const term of arr) {
      for (const word of term.toLowerCase().split(/\s+/)) {
        if (word.length > 3 && !/^(the|and|for|in|of|to|a|an|or|by|on|at|with|from|is|are|was|were|been|has|have|had|that|this|these|those|it|its|as|be|not|no|but)$/.test(word)) {
          ALL_E2_TERMS.add(word);
        }
      }
    }
  }
}

const BANNED_PATTERNS = [
  /\bfirst of all\b/i, /\bfirstly\b/i, /\bsecondly\b/i, /\bthirdly\b/i, /\bfinally\b/i,
  /\bin conclusion\b/i, /\bto sum up\b/i, /\ball in all\b/i,
  /\bon the one hand\b/i, /\bon the other hand\b/i,
  /\bin my humble opinion\b/i, /\bas we all know\b/i, /\bneedless to say\b/i, /\bit goes without saying\b/i,
];

// E2 中允许出现的关键词组（不强求完全命中术语，但必须有"实体感"关键词）
const PHYSICAL_INDICATORS = [
  /\bschool\b/i, /\bclassroom\b/i, /\bhospital\b/i, /\bfactory\b/i, /\bprison\b/i,
  /\bcourt\b/i, /\bcompany\b/i, /\bfirm\b/i, /\bcorporation\b/i,
  /\bchild\b/i, /\bteen\b/i, /\bparent\b/i, /\bteacher\b/i, /\bdoctor\b/i, /\bnurse\b/i,
  /\bworker\b/i, /\bstudent\b/i, /\bpatient\b/i, /\boffice\b/i,
  /\bwhiteboard\b/i, /\bCCTV\b/i, /\bsolar\b/i, /\bplastic\b/i, /\bice cap\b/i,
  /\bsubway\b/i, /\bmetro\b/i, /\bhighway\b/i, /\bcommuter\b/i,
  /\bgym\b/i, /\bcanteen\b/i, /\bInstagram\b/i, /\bTikTok\b/i, /\bYouTube\b/i,
  /\bvideo\b/i, /\bapp\b/i, /\bphone\b/i, /\bscreen\b/i, /\bgame\b/i,
  /\bpark\b/i, /\bforest\b/i, /\briver\b/i, /\bocean\b/i, /\bfish\b/i, /\bbird\b/i,
  /\bexhaust\b/i, /\bwaste\b/i, /\btrash\b/i, /\bgarbage\b/i, /\bsmog\b/i,
];

/**
 * 校验单段 PEEL 输出
 * @param {{ P: string, E1: string, E2: string, L: string }} peel
 * @returns {{ warnings: string[], score: { structure: number, layers: number, vocabs: number, physical: number } }}
 */
export function validatePeel(peel) {
  const warnings = [];
  const score = { structure: 0, layers: 0, vocabs: 0, physical: 0 };

  // --- 结构检查 ---
  const missing = [];
  if (!peel.P?.trim()) missing.push('P');
  if (!peel.E1?.trim()) missing.push('E1');
  if (!peel.E2?.trim()) missing.push('E2');
  if (!peel.L?.trim()) missing.push('L');
  if (missing.length > 0) {
    warnings.push(`Missing labels: ${missing.join(', ')}`);
  } else {
    score.structure = 1;
  }

  // --- 禁用词检查 ---
  const allText = [peel.P, peel.E1, peel.E2, peel.L].join(' ');
  for (const pat of BANNED_PATTERNS) {
    if (pat.test(allText)) {
      warnings.push(`Banned discourse glue detected: ${pat}`);
    }
  }

  // --- P 句检查 ---
  if (peel.P) {
    // P 不应包含举例词
    if (/\bfor example\b/i.test(peel.P)) warnings.push('P contains "for example"');
    if (/\bsuch as\b/i.test(peel.P)) warnings.push('P contains "such as"');
    // P 不应有长因果链（超过一个因果连接词）
    const causeCount = (peel.P.match(/\b(because|leads to|results in|causes?|triggers?|due to)\b/gi) || []).length;
    if (causeCount > 1) warnings.push('P has excessive causal chains — keep abstract');
  }

  // --- E1 检查 ---
  if (peel.E1) {
    const e1Lower = peel.E1.toLowerCase();
    // E1 不应包含物理实体关键词
    let e1EntityCount = 0;
    for (const term of ALL_E2_TERMS) {
      if (e1Lower.includes(term)) e1EntityCount++;
    }
    if (e1EntityCount > 2) warnings.push('E1 contains concrete entities — move to E2');
  }

  // --- E2 物理实体检查 ---
  if (peel.E2) {
    const e2Lower = peel.E2.toLowerCase();
    let physicalScore = 0;
    for (const pat of PHYSICAL_INDICATORS) {
      if (pat.test(peel.E2)) physicalScore++;
    }
    if (physicalScore === 0) {
      warnings.push('⚠️ E2 lacks ANY physical entity — add a concrete person/place/object/action');
      score.physical = 0;
    } else if (physicalScore < 2) {
      warnings.push('E2 is weak on physicality — goal: 2+ concrete indicators');
      score.physical = 0.5;
    } else {
      score.physical = 1;
    }
  }

  // --- L 检查 ---
  if (peel.L) {
    if (peel.L.split(/[.?!]/).filter(s => s.trim()).length > 2) {
      warnings.push('L is too long — should be one sentence max');
    }
  }

  // --- 层边界打分 ---
  if (!warnings.some(w => w.includes('P has') || w.includes('P contains'))) score.layers += 0.25;
  if (!warnings.some(w => w.includes('E1 contains'))) score.layers += 0.25;
  if (!warnings.some(w => w.includes('E2 lacks') || w.includes('E2 is weak'))) score.layers += 0.25;
  if (!warnings.some(w => w.includes('L is too'))) score.layers += 0.25;

  return { warnings, score };
}

/**
 * 批量校验
 */
export function validatePeels(peels) {
  const results = peels.map(peel => validatePeel(peel));
  const aggregated = {
    passed: results.every(r => r.warnings.length === 0),
    details: results,
    summary: {
      structure: results.reduce((s, r) => s + r.score.structure, 0) / Math.max(results.length, 1),
      layers: results.reduce((s, r) => s + r.score.layers, 0) / Math.max(results.length, 1),
      physical: results.reduce((s, r) => s + r.score.physical, 0) / Math.max(results.length, 1),
      totalWarnings: results.reduce((s, r) => s + r.warnings.length, 0),
    },
    allWarnings: results.flatMap(r => r.warnings),
  };
  return aggregated;
}
```

**此文件位置**：`server/evaluation/validator.js`

---

### 3.2 E2 实体库 JSON `server/knowledge/e2-entities.json`

将 `systemPrompt.js` 中 Module 2.2 的 E2 实体全部抽出为独立 JSON。结构如下：

```json
{
  "Education": {
    "people": ["kindergarteners", "rebellious teenagers", ...],
    "scenes": ["underfunded rural public schools", "elite boarding schools", ...],
    "objects": ["interactive whiteboards", "rote-learning flashcards", ...]
  },
  "Technology": { ... },
  "Environment": { ... },
  ...
}
```

**作用**：Validator 加载此文件，用于检测 E2 句是否包含物理实体。

---

### 3.3 按需注入 Prompt 构建器 `server/prompts/peelPrompt.js`

核心逻辑：不要再注入 8000 tokens 的全量知识库。根据输入自动识别母题，只注入该母题的词汇。

```javascript
// ============================================================
// server/prompts/peelPrompt.js
// ============================================================

import { retrieveTopic } from '../knowledge/topicRetriever.js';

/**
 * 构建精简版 PEEL Prompt
 * 只注入匹配到的母题知识（若无匹配则注入通用版）
 */
export function buildPeelPrompt({ input, topicResult }) {
  const baseSystem = `You are IELTS PEEL Hacker — cold logic engine for Writing Task 2 body paragraphs and Speaking Part 3.

⚡ FOUR SENTENCE LOCK [P]-[E1]-[E2]-[L]:
[P] Point (abstract verdict, no examples, no causal chain)
[E1] Explanation (unidirectional mechanism A→B, no concrete entities)
[E2] Example (physical entity strike — real people/places/objects/actions)
[L] Link (one-sentence seal back to P, no new claims)

Forbidden in PEEL body: First of all, Firstly, Secondly, In conclusion, To sum up, On the one hand.
Outside PEEL scope: listening, reading, Task 1, Part 1 chit-chat, emotional comfort.
Default language: English for PEEL. Chinese only for 底层逻辑 line.
After PEEL output add: ---\n底层逻辑：[母题 · 节点 · 模板名 · E2实体名]
`;

  // 若匹配到母题，注入该母题节点知识
  let topicSection = '';
  if (topicResult && topicResult.matchedTopics.length > 0) {
    const main = topicResult.matchedTopics[0];
    topicSection = `\n🎯 TOPIC CONTEXT (load these nodes + lexicon):\n`;
    for (const node of main.nodes) {
      topicSection += `- Node: ${node.name} | Logic: ${node.coreLogic} | Lexicon: ${node.lexicon.join(', ')}\n`;
    }
    if (main.e2Entities) {
      const people = main.e2Entities.people.slice(0, 5).join(', ');
      const scenes = main.e2Entities.scenes.slice(0, 3).join(', ');
      const objects = main.e2Entities.objects.slice(0, 5).join(', ');
      topicSection += `E2 Physical Entity Bank: [People] ${people} | [Scenes] ${scenes} | [Objects] ${objects}\n`;
    }
  } else {
    topicSection = `\n⚠️ Could not map to a specific topic. Use general academic lexicon: catalyst, proliferation, socioeconomic disparity, exacerbate, trigger, invariably lead to, a pivotal role, marginalized communities, holistic development, environmental degradation.\n`;
  }

  // 三大降维模型（精简版，始终注入）
  const modelsSection = `
🧩 UNIVERSAL REDUCTION MODELS (force-match one if prompt is comparative):
A) Generational Divide: Young (instant gratification/peer pressure/risk for taste) vs Old (tangible/interpersonal connection/preventative health)
B) Digital vs Physical: Physical (tangible texture/subtle non-verbal cues/collective catharsis) vs Digital (cold pixels/filtered micro-expressions/psychological isolation)
C) Past vs Present: Past (slow-paced/tranquil/durability) vs Present (instantaneous/sensory overload/disposable culture)
`;

  return `${baseSystem}${topicSection}${modelsSection}`;
}
```

---

### 3.4 母题关键词匹配器 `server/knowledge/topicRetriever.js`

```javascript
// ============================================================
// server/knowledge/topicRetriever.js
// ============================================================

import { readFileSync } from 'fs';

const TOPIC_KEYWORDS = {
  Education: [
    'education', 'school', 'university', 'college', 'student', 'teacher', 'classroom',
    'learning', 'curriculum', 'degree', 'online course', 'distance learning', 'homework',
    'exam', 'tuition', 'literacy', 'vocational', 'boarding school', 'private school',
    'public school', 'study', 'academic', 'scholar', 'graduate', 'campus', 'lecture',
    'seminar', 'tutor', 'pedagogy', 'extracurricular', 'standardized test', 'SAT', 'IELTS'
  ],
  Technology: [
    'technology', 'computer', 'internet', 'AI', 'artificial intelligence', 'smartphone',
    'mobile', 'app', 'algorithm', 'robot', 'automation', 'digital', 'software', 'cyber',
    'hacking', 'social media', 'Instagram', 'TikTok', 'screen time', 'gaming', 'video game',
    'virtual reality', 'VR', 'cloud', 'data', 'facial recognition', 'autonomous', 'remote work',
    'home office', 'push notification', 'cashless', 'manufacturing', 'assembly line'
  ],
  Environment: [
    'environment', 'climate', 'global warming', 'pollution', 'carbon', 'emission', 'plastic',
    'recycling', 'renewable', 'solar', 'wind', 'nuclear', 'fossil fuel', 'oil', 'gas',
    'deforestation', 'rainforest', 'wildlife', 'endangered', 'extinction', 'habitat',
    'ecosystem', 'biodiversity', 'conservation', 'sustainability', 'carbon tax', 'waste',
    'desertification', 'marine', 'ocean', 'industrial', 'coral reef', 'ice cap'
  ],
  Crime: [
    'crime', 'criminal', 'prison', 'jail', 'punishment', 'deterrence', 'rehabilitation',
    'juvenile', 'young offender', 'theft', 'robbery', 'shoplifting', 'white-collar',
    'embezzlement', 'felony', 'parole', 'CCTV', 'surveillance', 'police', 'court',
    'sentence', 'fraud', 'phishing', 'cybercrime', 'community service'
  ],
  Government: [
    'government', 'tax', 'taxation', 'taxpayer', 'budget', 'public fund', 'welfare',
    'healthcare', 'hospital', 'infrastructure', 'public transport', 'subsidy', 'subsidize',
    'tariff', 'regulation', 'censorship', 'food safety', 'corruption', 'city council',
    'progressive tax', 'wealth gap', 'inequality', 'social safety net', 'universal healthcare',
    'public good', 'market failure'
  ],
  Media: [
    'media', 'advertising', 'advertisement', 'ad', 'commercial', 'marketing', 'consumerism',
    'consumer', 'influencer', 'celebrity', 'paparazzi', 'journalist', 'journalism', 'news',
    'fake news', 'misinformation', 'echo chamber', 'click-bait', 'headline', 'tabloid',
    'broadcast', 'prime-time', 'junk food ad', 'vulnerable children', 'manipulation',
    'cultural homogenization', 'Hollywood', 'streaming'
  ],
  Urbanization: [
    'urban', 'urbanization', 'city', 'metropolis', 'migration', 'rural', 'countryside',
    'village', 'commuter', 'traffic', 'congestion', 'gridlock', 'subway', 'metro',
    'satellite town', 'suburb', 'sprawl', 'shantytown', 'slum', 'housing', 'property price',
    'rent', 'affordability', 'real estate', 'developer', 'pedestrian', 'cyclist',
    'congestion charge', 'green space', 'air quality', 'overcrowded', 'brain drain'
  ],
  Society: [
    'society', 'culture', 'tradition', 'heritage', 'cultural', 'custom', 'festival',
    'dialect', 'indigenous', 'senior citizen', 'retiree', 'aging', 'demographic',
    'extended family', 'nuclear family', 'dual-income', 'childcare', 'expatriate', 'immigrant',
    'immigration', 'minority', 'ethnic', 'gender', 'equality', 'discrimination',
    'glass ceiling', 'paternity leave', 'maternity leave', 'generational wealth',
    'ruins', 'monument', 'tourism', 'national identity', 'multicultural', 'cohesion', 'loneliness'
  ],
  Health: [
    'health', 'healthcare', 'medical', 'hospital', 'doctor', 'nurse', 'obesity',
    'overweight', 'diet', 'nutrition', 'sugar', 'processed food', 'junk food', 'soft drink',
    'metabolic', 'chronic disease', 'diabetes', 'cardiovascular', 'mental', 'psychological',
    'stress', 'burnout', 'occupational', 'work-life balance', 'prevention', 'fitness',
    'exercise', 'physical activity', 'cardio', 'gym', 'sedentary', 'sitting', 'desk job',
    'antidepressant', 'school meal', 'canteen'
  ]
};

/**
 * @param {string} input 用户输入
 * @returns {{ topicId: string|null, score: number, matchedKeywords: string[] }}
 */
export function classifyTopic(input) {
  const lower = input.toLowerCase();
  let bestTopic = null;
  let bestScore = 0;
  let matchedKeywords = [];

  for (const [topicId, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0;
    const matched = [];
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += 1;
        matched.push(kw);
        // 精确匹配加分
        if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) score += 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topicId;
      matchedKeywords = matched;
    }
  }

  if (bestScore >= 2) {
    return { topicId: bestTopic, score: bestScore, matchedKeywords };
  }
  return { topicId: null, score: 0, matchedKeywords: [] };
}

/**
 * 从知识库加载对应母题的完整数据
 */
export function loadTopicKnowledge(topicId) {
  if (!topicId) return null;
  try {
    // 把 topicId 转为文件名（如 Education → education.json）
    const filename = topicId.toLowerCase() + '.json';
    // 简单路径拼接（根据实际部署调整）
    const data = readFileSync(new URL(`./topics/${filename}`, import.meta.url), 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * 一站式：输入 → 分类 → 加载知识
 */
export function retrieveTopic(input) {
  const classification = classifyTopic(input);
  if (!classification.topicId) return { classification, knowledge: null };

  const knowledge = loadTopicKnowledge(classification.topicId);
  return { classification, knowledge };
}
```

---

### 3.5 Server 集成（修改 `server/index.js`）

关键改动：

```javascript
// ============================================================
// server/index.js (精简修改)
// ============================================================

import { retrieveTopic } from './knowledge/topicRetriever.js';
import { buildPeelPrompt } from './prompts/peelPrompt.js';
import { validatePeels } from './evaluation/validator.js';

// ... 保持现有的 express 初始化 ...

app.post('/api/generate', async (req, res) => {
  // ... 参数解析不变 ...

  // ===== 新增：母题检索 + 按需 Prompt 构建 =====
  const { classification, knowledge: matchedTopic } = retrieveTopic(input);

  const dynamicSystem = buildPeelPrompt({
    input,
    topicKnowledge: matchedTopic,
    topicId: classification.topicId,
  });

  const messages = [
    { role: 'system', content: dynamicSystem },
    ...normalizeHistory(history),
    { role: 'user', content: userContent },
  ];

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 2500,
  });

  const content = completion.choices?.[0]?.message?.content || '';

  // ===== 新增：输出校验 =====
  const parsed = parsePeelOutput(content);
  const validation = validatePeels(parsed.peels);

  res.json({
    ok: true,
    command,
    model,
    content,
    parsed,
    usage: completion.usage,
    // 新增字段
    topic: { id: classification.topicId, score: classification.score },
    validation,
  });
});
```

---

## 4. 阶段二：知识结构化（P1）

### 4.1 目标

把 `systemPrompt.js` 中的全部知识（9 母题节点、词汇、E2 实体）拆成独立 JSON 文件，使知识可检索、可版本控制、可独立测试。

### 4.2 文件结构

```
server/knowledge/
├── topics/
│   ├── education.json       # 4 节点 + 抽象词汇 + E2 实体
│   ├── technology.json
│   ├── environment.json
│   ├── crime.json
│   ├── government.json
│   ├── media.json
│   ├── urbanization.json
│   ├── society.json
│   └── health.json
├── e2-entities.json          # E2 实体全集（Validator 引用）
├── models.json               # 三大降维模型定义
├── templates.json             # P/E1/E2/L 句式模板库
└── topicRetriever.js          # 分类器 + 检索器
```

### 4.3 单个 Topic JSON 格式

```json
{
  "topic": "Education",
  "nodes": [
    {
      "id": "social_emotional",
      "name": "Social & Emotional",
      "trigger": ["online vs offline class", "boarding", "arts vs STEM", "PE necessity"],
      "coreLogic": "Education is fundamentally human socialization; machines cannot supply empathy and teamwork.",
      "lexicon": ["cultivate empathy", "interpersonal communication skills", "instill moral values", ...],
      "pTemplates": {
        "catalyst": "The most compelling justification for [stance] lies in the fact that [A] acts as a primary catalyst for [B], thereby significantly altering the landscape of [C].",
        "absence": "The most compelling justification for [stance] lies in the fact that the absence of [A] inherently breeds [B], ultimately jeopardizing [C].",
        "doubleEdged": "At the core of this issue is the stark reality that while [A] offers undeniable conveniences, it simultaneously exacts a heavy toll on [B]."
      },
      "e1Templates": {
        "forwardCausal": "To be more specific, this means that [mechanism], which inevitably leads to [result].",
        "counterfactual": "Had this approach not been adopted, [subject] would have suffered from [catastrophic outcome].",
        "contrastive": "This stands in stark contrast to [foil], where [flawed mechanism] is fundamentally flawed."
      }
    }
  ],
  "e2Entities": {
    "people": [...],
    "scenes": [...],
    "objects": [...]
  }
}
```

### 4.4 `models.json` — 三大降维模型

```json
{
  "A": {
    "name": "Generational Divide (Young vs Old)",
    "trigger": ["shopping", "apps", "food", "leisure", "travel", "language learning", "tech attitude", "smiling reasons", "age contrast"],
    "axes": {
      "pace": { "young": "instant gratification, digital natives, fast-paced fragmented streams", "old": "tangible experience, slow-paced immersive traditional modes" },
      "value": { "young": "peer pressure, self-display, trends, fashion", "old": "interpersonal connection, nostalgia, durability" },
      "health": { "young": "risk for taste/experience, processed foods, sleep debt", "old": "preventative health, avoid chronic metabolic disorders" }
    },
    "skeleton": "Well, there's a profound generational divide here, mainly driven by their different priorities in life. While the youth tend to... the elderly usually..."
  },
  "B": {
    "name": "Digital vs Physical (Presence vs Simulation)",
    "trigger": ["online vs campus", "chat vs face-to-face", "e-news vs paper", "e-commerce vs stores", "streaming vs live concert"],
    "axes": {
      "sensory": { "physical": "tangible texture, sanctuary from digital distractions, uninterrupted focus", "digital": "cold pixels, pop-up interference, fragmented attention" },
      "microSignals": { "physical": "subtle non-verbal cues, genuine empathy, emotional resonance", "digital": "filters out eye contact, micro-expressions, presence" },
      "collectiveEnergy": { "physical": "contagious energy, collective catharsis, societal cohesion", "digital": "psychological isolation, no emotional community exchange" }
    },
    "skeleton": "Personally, I highly doubt it. While digital alternatives offer undeniable conveniences, physical mediums possess an intrinsic value that cannot be replaced."
  },
  "C": {
    "name": "Past vs Present (Paradigm Shift)",
    "trigger": ["quieter places gone", "communication change", "gifts change", "community bonds", "stricter norms", "social rules evolution"],
    "axes": {
      "tech": { "past": "slow-paced, tangible, physical texture", "present": "instantaneous, digital, fragmented, screen-mediated" },
      "urban": { "past": "tranquil, near nature, open spaces", "present": "overcrowded, sensory overload, concrete jungles" },
      "consumption": { "past": "scarcity, durability, repair culture", "present": "surplus, disposability, throwaway consumerism" }
    },
    "skeleton": "Well, there's been a massive paradigm shift. Back in the day, people used to [past state]. However, nowadays, we are increasingly witnessing [present state]."
  }
}
```

---

## 5. 阶段三：编排器 + 评估器（P1）

### 5.1 统一 LLM 客户端 `server/utils/llmClient.js`

```javascript
// ============================================================
// server/utils/llmClient.js
// ============================================================

import OpenAI from 'openai';

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

/**
 * 统一 LLM 调用封装
 */
export async function callLLM({ apiKey, baseUrl, model, system, user, history = [], temperature = 0.3, maxTokens = 2500 }) {
  const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, '') });

  const messages = [
    { role: 'system', content: system },
    ...history.slice(-12).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: user },
  ];

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const content = completion.choices?.[0]?.message?.content || '';
      const usage = completion.usage || null;

      return { content, usage, ok: true };
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.response?.status || 500;

      // 4xx 错误不重试（auth 失败、参数错等）
      if (status >= 400 && status < 500) break;

      // 5xx / network error → 等一会儿重试
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BASE_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('LLM request failed after retries');
}

/**
 * 流式版本（预留）
 */
export async function* streamLLM({ apiKey, baseUrl, model, system, user, history = [], temperature = 0.3 }) {
  const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, '') });
  const messages = [
    { role: 'system', content: system },
    ...history.slice(-12).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: user },
  ];

  const stream = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: 2500,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
```

---

### 5.2 编排器 `server/orchestrator.js`

```javascript
// ============================================================
// server/orchestrator.js
// ============================================================

import { buildPeelPrompt } from './prompts/peelPrompt.js';
import { callLLM } from './utils/llmClient.js';
import { parsePeelOutput } from './parsing/peelParser.js';
import { validatePeels } from './evaluation/validator.js';
import { retrieveTopic } from './knowledge/topicRetriever.js';

export async function runPeelPipeline({ input, history, apiKey, baseUrl, model }) {
  const { classification, knowledge: topicKnowledge } = retrieveTopic(input);

  const system = buildPeelPrompt({
    input,
    topicKnowledge,
    topicId: classification.topicId,
  });

  const userMessage = input.trim().startsWith('/peel')
    ? input.trim()
    : `/peel ${input.trim()}`;

  // 第一轮：生成
  const { content, usage } = await callLLM({
    apiKey, baseUrl, model,
    system,
    user: userMessage,
    history,
  });

  // 解析 + 校验
  const parsed = parsePeelOutput(content);
  const validation = validatePeels(parsed.peels);

  // 如果校验不通过，自动重试一次（把 warnings 注入第二轮）
  let finalContent = content;
  let finalParsed = parsed;
  let finalValidation = validation;
  let retries = 0;

  if (!validation.passed && validation.allWarnings.length > 0) {
    retries = 1;
    const correctionHint = `Your previous output had these quality issues:\n${validation.allWarnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\nPLEASE REGENERATE. Fix all issues.`;

    const corrected = await callLLM({
      apiKey, baseUrl, model,
      system,
      user: `${userMessage}\n\n[CORRECTION INSTRUCTION]\n${correctionHint}`,
      history,
    });

    finalContent = corrected.content;
    finalParsed = parsePeelOutput(finalContent);
    finalValidation = validatePeels(finalParsed.peels);
  }

  return {
    content: finalContent,
    parsed: finalParsed,
    usage,
    topic: { id: classification.topicId, score: classification.score },
    validation: finalValidation,
    retries,
  };
}
```

---

### 5.3 `/score` 命令 — 给用户的 PEEL 打分

新增命令：用户粘贴自己的 PEEL，系统不生成，只评分。

```javascript
// orchestrator.js 中追加

export async function runScorePipeline({ input, apiKey, baseUrl, model }) {
  // 纯程序化评分（不调 LLM）
  const parsed = parsePeelOutput(input);
  const validation = validatePeels(parsed.peels);

  // 如果是裸文本无标签，尝试简单解析
  if (parsed.peels.length === 0) {
    const lines = input.split(/\n/).filter(l => l.trim());
    if (lines.length >= 3 && lines.length <= 5) {
      // 假设是 P/E1/E2/L 分成多行
      const [p, e1, e2, l] = lines;
      const fakePeel = { P: p || '', E1: e1 || '', E2: e2 || '', L: l || '' };
      const v = validatePeels([fakePeel]);
      return { parsed: { peels: [fakePeel] }, validation: v };
    }
  }

  return { parsed, validation };
}
```

**Express 路由**：
```javascript
app.post('/api/score', async (req, res) => {
  const { input } = req.body;
  const result = await runScorePipeline({ input });
  res.json({ ok: true, ...result });
});
```

---

### 5.4 评估器增强 `server/evaluation/evaluator.js`

在 validator 基础上加一层 AI 语义评估（可选，调 LLM 做"反向打分"）：

```javascript
/**
 * AI 语义评估：让另一个 LLM 实例（或用同样的）给 PEEL 的四个维度打分
 */
export async function aiSemanticScore(peel, apiKey, baseUrl, model) {
  const evalPrompt = `You are an IELTS writing examiner. Score this PEEL paragraph on 4 dimensions (1-9 scale, 0.5 increments):

[P] ${peel.P}
[E1] ${peel.E1}
[E2] ${peel.E2}
[L] ${peel.L}

Respond ONLY with a JSON object:
{
  "P_score": <task response quality — abstract, clear, qualifying, 1-9>,
  "E1_score": <explanation quality — causal mechanism depth, 1-9>,
  "E2_score": <example quality — physicality, concreteness, 1-9>,
  "L_score": <link quality — closure, no new info, 1-9>,
  "overall": <weighted average, 1-9>,
  "topIssue": "<one-line: most critical weakness>"
}`;

  const result = await callLLM({
    apiKey, baseUrl, model,
    system: 'You are an IELTS examiner. Score coldly. No encouragement. Return JSON only.',
    user: evalPrompt,
    temperature: 0.1,
    maxTokens: 300,
  });

  try {
    return JSON.parse(result.content);
  } catch {
    return null;
  }
}
```

---

## 6. 阶段四：记忆与教练系统（P2）

### 6.1 用户记忆层 `server/memory/userMemory.js`

```javascript
// ============================================================
// server/memory/userMemory.js
// ============================================================

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const MEMORY_DIR = join(process.cwd(), '.memory');

// 确保目录存在
export function ensureMemoryDir() {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
}

export function getUserMemory(userId = 'default') {
  ensureMemoryDir();
  const path = join(MEMORY_DIR, `${userId}.json`);
  if (!existsSync(path)) return createEmptyMemory(userId);
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return createEmptyMemory(userId);
  }
}

function createEmptyMemory(userId) {
  return {
    userId,
    createdAt: new Date().toISOString(),
    e2Fuel: [],        // [{ topic, entity, sourceQuestion, sourceAnswer, ts }]
    scripts: [],       // [{ topic, nodes, peel: { P, E1, E2, L }, ts }]
    stats: {
      totalPeels: 0,
      totalMatrices: 0,
      totalWizards: 0,
      topTopics: {},
      avgValidationScore: 0,
    },
    weaknesses: {},    // { P: count, E1: count, E2: count, L: count }
  };
}

export function saveUserMemory(userId, memory) {
  ensureMemoryDir();
  writeFileSync(join(MEMORY_DIR, `${userId}.json`), JSON.stringify(memory, null, 2));
}

export function addE2Fuel(userId, { topic, entity, sourceQuestion, sourceAnswer }) {
  const mem = getUserMemory(userId);
  mem.e2Fuel.push({ topic, entity, sourceQuestion, sourceAnswer, ts: Date.now() });
  // 保留最近 200 条
  if (mem.e2Fuel.length > 200) mem.e2Fuel = mem.e2Fuel.slice(-200);
  saveUserMemory(userId, mem);
}

export function recordPeelResult(userId, { topicId, validation }) {
  const mem = getUserMemory(userId);
  mem.stats.totalPeels += 1;
  mem.stats.topTopics[topicId] = (mem.stats.topTopics[topicId] || 0) + 1;

  // 记录薄弱环节
  if (validation && validation.allWarnings) {
    for (const warn of validation.allWarnings) {
      if (warn.includes('P ')) mem.weaknesses.P = (mem.weaknesses.P || 0) + 1;
      if (warn.includes('E1 ')) mem.weaknesses.E1 = (mem.weaknesses.E1 || 0) + 1;
      if (warn.includes('E2 ')) mem.weaknesses.E2 = (mem.weaknesses.E2 || 0) + 1;
      if (warn.includes('L ')) mem.weaknesses.L = (mem.weaknesses.L || 0) + 1;
    }
  }

  saveUserMemory(userId, mem);
}

export function getWeaknessReport(userId) {
  const mem = getUserMemory(userId);
  const total = Object.values(mem.weaknesses).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return {
    weaknesses: mem.weaknesses,
    suggestion: mem.weaknesses.E2 > mem.weaknesses.P
      ? 'Your E2 (examples) are the weakest link. Focus on adding concrete physical scenes.'
      : 'Your abstract reasoning (P/E1) needs work.',
  };
}

export function getRelevantFuel(userId, topicId) {
  const mem = getUserMemory(userId);
  return mem.e2Fuel
    .filter(f => f.topic === topicId)
    .slice(-10)
    .reverse();
}
```

### 6.2 在 `/peel` + `/wizard` 中集成记忆

在 `orchestrator.js` 的 `runPeelPipeline` 开始时注入用户记忆：

```javascript
import { getUserMemory, recordPeelResult, getRelevantFuel } from './memory/userMemory.js';

export async function runPeelPipeline({ input, history, apiKey, baseUrl, model, userId = 'default' }) {
  const { classification, knowledge: topicKnowledge } = retrieveTopic(input);

  // 注入用户记忆中的 E2 燃料
  const userFuel = getRelevantFuel(userId, classification.topicId);
  const fuelHint = userFuel.length > 0
    ? `\n[USER E2 FUEL — prefer these personal entities]: ${userFuel.map(f => f.entity).join(' | ')}\n`
    : '';

  const system = buildPeelPrompt({ input, topicKnowledge, topicId: classification.topicId }) + fuelHint;

  // ... 执行 LLM ...

  // 记录结果
  recordPeelResult(userId, { topicId: classification.topicId, validation: finalValidation });

  return { ... };
}
```

---

## 7. 阶段五：前端进化（P2）

### 7.1 EvaluationPanel — 评估结果面板

```jsx
// client/src/components/EvaluationPanel.jsx

export default function EvaluationPanel({ validation, weak }) {
  if (!validation) return null;

  const { summary, details, allWarnings, passed } = validation;

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${passed ? 'border-acid-500/30 bg-acid-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`font-mono text-xs font-semibold ${passed ? 'text-acid-400' : 'text-amber-400'}`}>
          {passed ? '✓ QUALITY PASS' : '⚠ QUALITY GATE'}
        </span>
        <span className="text-[11px] text-slate-500">
          structure: {summary.structure.toFixed(1)} | layers: {summary.layers.toFixed(1)} | physical: {summary.physical.toFixed(1)}
        </span>
      </div>
      {allWarnings.length > 0 && (
        <ul className="space-y-1">
          {allWarnings.map((w, i) => (
            <li key={i} className="text-[11px] leading-relaxed text-amber-300/90">• {w}</li>
          ))}
        </ul>
      )}
      {weak && (
        <div className="mt-2 rounded bg-white/5 px-2 py-1.5 text-[11px] text-slate-400">
          {weak}
        </div>
      )}
    </div>
  );
}
```

### 7.2 PeelEditor — 可编辑 PEEL

```jsx
// client/src/components/PeelEditor.jsx

import { useState } from 'react';

export default function PeelEditor({ peel, onSave }) {
  const [lines, setLines] = useState({
    P: peel?.P || '',
    E1: peel?.E1 || '',
    E2: peel?.E2 || '',
    L: peel?.L || '',
  });

  const labels = [
    { key: 'P', color: 'text-purple-400', label: 'Point' },
    { key: 'E1', color: 'text-blue-400', label: 'Explanation' },
    { key: 'E2', color: 'text-acid-400', label: 'Example' },
    { key: 'L', color: 'text-orange-400', label: 'Link' },
  ];

  return (
    <div className="space-y-2">
      {labels.map(({ key, color, label }) => (
        <div key={key} className="flex items-start gap-2">
          <span className={`mt-2 font-mono text-xs font-semibold min-w-[24px] ${color}`}>[{key}]</span>
          <textarea
            className="flex-1 rounded-md border border-white/10 bg-ink-950/60 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-600 resize-none"
            rows={key === 'E1' || key === 'E2' ? 3 : 2}
            value={lines[key]}
            onChange={(e) => setLines(prev => ({ ...prev, [key]: e.target.value }))}
            placeholder={`${label}...`}
          />
        </div>
      ))}
      <button
        className="btn-primary mt-2 text-xs"
        onClick={() => onSave(lines)}
      >
        Save & Re-validate
      </button>
    </div>
  );
}
```

### 7.3 EntityHighlighter — PEEL 实体高亮

```jsx
// client/src/components/EntityHighlighter.jsx

const ENTITY_COLORS = {
  people: 'bg-violet-500/20 text-violet-300',
  scene: 'bg-cyan-500/20 text-cyan-300',
  object: 'bg-amber-500/20 text-amber-300',
  abstract: 'bg-slate-500/20 text-slate-400',
};

export default function EntityHighlighter({ text, entities }) {
  if (!entities || entities.length === 0) {
    return <div className="text-xs text-slate-500">No entities detected</div>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {entities.map((e, i) => (
        <span key={i} className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${ENTITY_COLORS[e.type] || ENTITY_COLORS.abstract}`}>
          {e.word}
        </span>
      ))}
    </div>
  );
}
```

### 7.4 `/score` 模式 — 前端支持

在 `CommandPanel.jsx` 新增第四个标签：

```jsx
{ id: 'score', label: '/score', title: 'PEEL 评分', hint: '粘贴你的 PEEL → 自动评估四层质量' }
```

---

## 8. 阶段六：测试与 CI/CD

### 8.1 测试目录结构

```
peel-hacker-app/
├── tests/
│   ├── unit/
│   │   ├── topicRetriever.test.js    # 母题分类正确性
│   │   ├── validator.test.js         # 校验器逻辑
│   │   ├── peelParser.test.js        # PEEL 解析
│   │   └── promptBuilder.test.js     # Prompt 构建
│   ├── integration/
│   │   └── pipeline.test.js          # 端到端流程
│   └── golden/
│       └── peel-cases.json           # 黄金样本集
├── vitest.config.js
└── package.json                      # 添加 "test": "vitest run"
```

### 8.2 黄金样本 `tests/golden/peel-cases.json`

```json
[
  {
    "id": "case_01_education_social",
    "input": "Some people think online education can replace traditional classrooms. To what extent do you agree or disagree?",
    "expectedTopic": "Education",
    "expectedNode": "social_emotional",
    "constraints": {
      "P_minWords": 10,
      "P_forbidden": ["whiteboard", "classroom", "CCTV", "example"],
      "E1_forbidden": ["whiteboard", "classroom", "CCTV", "student", "teacher"],
      "E2_required": ["student", "teacher", "classroom", "campus", "dormitory", "seminar"],
      "bannedDiscourse": ["First of all", "Secondly", "In conclusion"],
      "sentenceCount": 4
    }
  },
  {
    "id": "case_02_tech_alienation",
    "input": "Social media is making people more lonely. Do you agree?",
    "expectedTopic": "Technology",
    "expectedNode": "social_alienation_health",
    "constraints": {
      "E2_required": ["family", "restaurant", "phone", "screen", "notification"],
      "P_forbidden": ["phone", "screen", "restaurant"]
    }
  }
]
```

### 8.3 测试示例 `tests/unit/validator.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { validatePeel } from '../../server/evaluation/validator.js';

describe('PEEL Validator', () => {
  it('passes a well-formed PEEL', () => {
    const peel = {
      P: 'The absence of physical schooling breeds deficits in social competency.',
      E1: 'This means young people miss the daily peer-to-peer negotiations that teach conflict resolution and empathy.',
      E2: 'Take university seminar rooms: students who study entirely online never build the impromptu study groups at whiteboards that become lifelong professional networks.',
      L: 'Thus, physical attendance plays an irreplaceable role in holistic education.',
    };
    const result = validatePeel(peel);
    expect(result.warnings.filter(w => w.includes('E2 lacks'))).toHaveLength(0);
    expect(result.score.structure).toBe(1);
  });

  it('flags P with causal chain', () => {
    const peel = {
      P: 'Online education reduces social skills because students do not interact face to face, which leads to weaker communication abilities.',
      E1: 'This is important.',
      E2: 'For example, students at universities.',
      L: 'So it matters.',
    };
    const result = validatePeel(peel);
    expect(result.warnings.some(w => w.includes('P has'))).toBe(true);
  });

  it('flags E2 without physical entities', () => {
    const peel = {
      P: 'Online education weakens social skills.',
      E1: 'This happens because interaction is reduced.',
      E2: 'Research shows that social skills are very important for people in society to succeed in their careers and personal lives.',
      L: 'So it matters.',
    };
    const result = validatePeel(peel);
    expect(result.warnings.some(w => w.includes('E2 lacks'))).toBe(true);
    expect(result.score.physical).toBe(0);
  });

  it('detects banned discourse glue', () => {
    const peel = {
      P: 'Online education weakens social skills.',
      E1: 'This happens because interaction is reduced.',
      E2: 'For example, students at universities use apps to communicate.',
      L: 'In conclusion, this is a serious issue.',
    };
    const result = validatePeel(peel);
    expect(result.warnings.some(w => w.includes('Banned'))).toBe(true);
  });
});
```

### 8.4 CI 配置 `.github/workflows/eval.yml`

```yaml
name: PEEL Quality Gate

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx vitest run tests/unit/

  golden-test:
    runs-on: ubuntu-latest
    needs: unit-test
    env:
      TEST_LLM_KEY: ${{ secrets.TEST_LLM_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx vitest run tests/integration/ tests/golden/
```

---

## 9. 阶段七：部署与可观测性

### 9.1 结构化日志

```javascript
// server/utils/logger.js

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

export function log(level, event, data = {}) {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

// 使用示例
log('INFO', 'peel.generated', {
  topic: 'Education',
  node: 'social_emotional',
  tokens: 450,
  validationPassed: true,
  retries: 0,
});
```

### 9.2 指标体系（Prometheus 兼容）

```javascript
// server/utils/metrics.js

const metrics = {
  peelTotal: 0,
  peelFailed: 0,
  tokenUsed: 0,
  latencyMs: [],
  topicDistribution: {},
  validationPassRate: 0,
};

export function recordPeel({ topicId, tokens, latency, passed }) {
  metrics.peelTotal += 1;
  metrics.tokenUsed += tokens;
  metrics.topicDistribution[topicId] = (metrics.topicDistribution[topicId] || 0) + 1;
  if (!passed) metrics.peelFailed += 1;
  metrics.latencyMs.push(latency);
  if (metrics.latencyMs.length > 1000) metrics.latencyMs.shift();
  metrics.validationPassRate = ((metrics.peelTotal - metrics.peelFailed) / metrics.peelTotal * 100).toFixed(1);
}

// GET /api/metrics 暴露
app.get('/api/metrics', (_req, res) => {
  res.json({
    ...metrics,
    avgLatency: metrics.latencyMs.length > 0
      ? (metrics.latencyMs.reduce((a, b) => a + b, 0) / metrics.latencyMs.length).toFixed(1)
      : 0,
  });
});
```

### 9.3 错误处理中间件

```javascript
// 全局错误捕获
app.use((err, req, res, _next) => {
  log('ERROR', 'unhandled.error', { message: err.message, stack: err.stack });
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// LLM 调用失败友好降级
function handleLLMError(err) {
  if (err?.status === 429) return 'API rate limit reached. Wait 30 seconds and retry.';
  if (err?.status === 401 || err?.status === 403) return 'Invalid API key. Check your credentials.';
  if (err?.status === 503) return 'LLM provider is temporarily unavailable. Try again in a few minutes.';
  return `LLM request failed: ${err?.message || 'unknown error'}`;
}
```

---

## 10. 完整文件规划

```
peel-hacker-app/
├── docs/
│   └── EVOLUTION_BLUEPRINT.md        # 本文档
├── .memory/                           # 运行时生成，gitignore
│   └── {userId}.json
├── .github/workflows/
│   └── eval.yml
├── tests/
│   ├── unit/
│   │   ├── topicRetriever.test.js
│   │   ├── validator.test.js
│   │   ├── peelParser.test.js
│   │   └── promptBuilder.test.js
│   ├── integration/
│   │   └── pipeline.test.js
│   └── golden/
│       └── peel-cases.json
├── server/
│   ├── index.js                      # 精简：express + 路由 → orchestrator
│   ├── orchestrator.js                # 核心编排
│   ├── skills/
│   │   ├── peelSkill.js              # /peel 技能
│   │   ├── matrixSkill.js            # /matrix 技能
│   │   ├── wizardSkill.js            # /wizard 技能
│   │   └── scoreSkill.js             # /score 技能
│   ├── prompts/
│   │   ├── baseSystem.js             # 基础人设 Prompt（无母题词汇）
│   │   ├── peelPrompt.js             # /peel 专用 Prompt 构建
│   │   ├── matrixPrompt.js           # /matrix 专用 Prompt 构建
│   │   ├── wizardPrompt.js           # /wizard 专用 Prompt 构建
│   │   └── scorePrompt.js            # /score 评估 Prompt
│   ├── parsing/
│   │   └── peelParser.js             # PEEL 结构化解析（复用 + 增强）
│   ├── knowledge/
│   │   ├── topics/
│   │   │   ├── education.json
│   │   │   ├── technology.json
│   │   │   ├── environment.json
│   │   │   ├── crime.json
│   │   │   ├── government.json
│   │   │   ├── media.json
│   │   │   ├── urbanization.json
│   │   │   ├── society.json
│   │   │   └── health.json
│   │   ├── e2-entities.json           # E2 实体全集
│   │   ├── models.json                # 三大降维模型
│   │   ├── templates.json             # PEEL 句式模板
│   │   ├── keywords.json              # 母题关键词索引
│   │   └── topicRetriever.js          # 检索器
│   ├── evaluation/
│   │   ├── validator.js               # 程序化校验
│   │   └── aiScorer.js                # AI 语义评分
│   ├── memory/
│   │   └── userMemory.js              # 用户记忆 CRUD
│   ├── utils/
│   │   ├── llmClient.js               # 统一 LLM 调用（重试、流式）
│   │   ├── logger.js                  # 结构化日志
│   │   └── metrics.js                 # Prometheus 指标
│   └── systemPrompt.js                # 保留：向后兼容的旧版 Prompt
├── client/src/components/
│   ├── EvaluationPanel.jsx            # 评估结果面板
│   ├── PeelEditor.jsx                 # PEEL 可编辑区
│   ├── EntityHighlighter.jsx          # 实体高亮
│   └── ScorePanel.jsx                 # /score 专用面板
├── vitest.config.js
└── package.json
```

---

## 11. 实施路线图

| Week | 阶段 | 核心交付 | 预计工时 | 依赖 |
|------|------|----------|---------|------|
| **1** | 防御层 P0 | `validator.js`, `e2-entities.json`, `topicRetriever.js`, `peelPrompt.js`, 修改 `index.js` 集成 | 4h | 无 |
| **2** | 知识结构化 P1 | 9 个 `topics/*.json`, `models.json`, `templates.json`, `keywords.json` | 3h | W1 |
| **3** | 编排器 P1 | `orchestrator.js`, `skills/*.js`, `llmClient.js`, `peelParser.js` | 4h | W2 |
| **4** | 评估器 P1 | `evaluator.js`, `aiScorer.js`, `/score` 命令, 自动重试逻辑 | 3h | W3 |
| **5** | 记忆系统 P2 | `userMemory.js`, orchestrator 集成, Wizard 闭环 | 3h | W3 |
| **6** | 前端 P2 | `EvaluationPanel`, `PeelEditor`, `EntityHighlighter`, ResultPanel 集成 | 4h | W4 |
| **7** | 测试 CI/CD | 单元测试, 黄金样本, `eval.yml` | 3h | W4 |
| **8** | 可观测性 | 结构化日志, `/metrics`, 错误处理中间件, 流式输出 | 3h | W3 |

**总预估工时**：约 27 小时。**建议零散时间逐步推进，每个阶段的文件可独立合入 main 分支，不必一次性全部完成。**

---

## 附录：关键设计原则

1. **每个 JSON 文件必须能独立验证**：解耦后，任意一个 Topic JSON 损坏不影响其他母题
2. **Validator 永远不给假阳性**：宁可漏报，不可误报（避免打击用户信心）
3. **LLM 调用失败降级为先**：不能因为 AI 挂了导致整个系统不可用
4. **知识库和 Prompt 双向同步**：改 JSON → 自动 diff 到 System Prompt（用 `build-prompt.mjs` 脚本）
5. **所有新命令的前端组件必须先做骨架**：一个 `<div>` + 硬编码示例数据 → 再连 API
