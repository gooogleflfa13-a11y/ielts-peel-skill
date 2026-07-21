import { BASE_SYSTEM, MODELS_SECTION } from './baseSystem.js';

/**
 * Build lean PEEL system prompt — inject only matched topic knowledge.
 */
export function buildPeelPrompt({ topicKnowledge = null, topicId = null, fuelHint = '' } = {}) {
  const resolvedTopicId = topicId || topicKnowledge?.topic || 'General';
  let topicSection = '';

  if (topicKnowledge?.nodes?.length) {
    topicSection = `\n🎯 TOPIC CONTEXT (${resolvedTopicId}): load these nodes + lexicon:\n`;
    for (const node of topicKnowledge.nodes) {
      const lex = (node.lexicon || []).slice(0, 10).join(', ');
      topicSection += `- Node: ${node.name} | Logic: ${node.coreLogic} | Lexicon: ${lex}\n`;
    }
    const e2 = topicKnowledge.e2Entities;
    if (e2) {
      const people = (e2.people || []).slice(0, 5).join(', ');
      const scenes = (e2.scenes || []).slice(0, 3).join(', ');
      const objects = (e2.objects || []).slice(0, 5).join(', ');
      topicSection += `E2 Physical Entity Bank: [People] ${people} | [Scenes] ${scenes} | [Objects] ${objects}\n`;
    }
  } else {
    topicSection = `
⚠️ Could not map to a specific topic. Use general academic lexicon: catalyst, proliferation, socioeconomic disparity, exacerbate, trigger, invariably lead to, a pivotal role, marginalized communities, holistic development, environmental degradation.
E2 must still use concrete people/places/objects/actions.
`;
  }

  const outputRule = `
OUTPUT FORMAT (exact):
[P] <one English sentence>
[E1] <one English sentence>
[E2] <one English sentence with physical entities>
[L] <one English sentence>

---
底层逻辑：<ONE Chinese line: 母题 · 节点 · 模板名 · E2实体名>
`;

  return `${BASE_SYSTEM}${topicSection}${MODELS_SECTION}${fuelHint}${outputRule}`;
}
