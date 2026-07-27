import { BASE_SYSTEM, MODELS_SECTION, SPEAKING_SYSTEM } from './baseSystem.js';

/**
 * Build lean PEEL system prompt - inject only matched topic knowledge.
 * Learner fuel (user text) is NEVER placed in the system tier; the skill
 * injects it as a quoted user_context data block in the user message.
 *
 * skill: 'writing' (default) selects the academic-register template;
 *        'speaking' selects the natural-fluency template (interaction
 *        markers permitted, academic banned-glue list NOT enforced).
 */
export function buildPeelPrompt({
  topicKnowledge = null,
  topicId = null,
  skill = 'writing',
} = {}) {
  const isSpeaking = skill === 'speaking';
  const base = isSpeaking ? SPEAKING_SYSTEM : BASE_SYSTEM;
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
    topicSection = isSpeaking
      ? `
⚠️ Could not map to a specific topic. Use natural spoken lexicon: you know, I mean, well, like, to be honest - keep it oral and fluent.
E2 must still use concrete people/places/objects/actions.
`
      : `
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

  return `${base}${topicSection}${MODELS_SECTION}${outputRule}`;
}
