import { BASE_SYSTEM, MODELS_SECTION } from './baseSystem.js';

export function buildMatrixPrompt({ topicKnowledge = null, topicId = null, reductionModel = null } = {}) {
  let topicSection = '';
  if (topicKnowledge?.nodes?.length) {
    topicSection = `\n🎯 TOPIC: ${topicId || topicKnowledge.topic}\n`;
    for (const node of topicKnowledge.nodes.slice(0, 3)) {
      topicSection += `- ${node.name}: ${node.coreLogic}\n`;
    }
    const e2 = topicKnowledge.e2Entities;
    if (e2) {
      topicSection += `E2 pool: ${(e2.people || []).slice(0, 3).join(', ')}; ${(e2.scenes || []).slice(0, 2).join(', ')}; ${(e2.objects || []).slice(0, 3).join(', ')}\n`;
    }
  }

  let modelHint = '';
  if (reductionModel) {
    modelHint = `\nSuggested primary model: Model ${reductionModel.id} — ${reductionModel.name}\nSkeleton: ${reductionModel.skeleton || ''}\n`;
  }

  const outputRule = `
Command: /matrix
OUTPUT FORMAT:

## 命中模型
Model [A|B|C]: <name> — <why ≤15 words>

## 底层骨架 (≤4 bullets)
- ...

## 基准 PEEL（对本现象）
[P] ...
[E1] ...
[E2] ...
[L] ...

## 横向秒杀 ×3
### 题1: <IELTS-style question>
[P] ...
[E1] ...
[E2] ...
[L] ...
### 题2: ...
### 题3: ...

## 逻辑同构说明
一句话中文：三题共用的不可变机制；仅 E2 场景替换了什么。

Each PEEL block is exactly four labeled sentences. No discourse glue.
`;

  return `${BASE_SYSTEM}${MODELS_SECTION}${topicSection}${modelHint}${outputRule}`;
}
