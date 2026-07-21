import { BASE_SYSTEM, MODELS_SECTION } from './baseSystem.js';

export function buildWizardPrompt({ topicKnowledge = null, topicId = null } = {}) {
  let topicSection = '';
  if (topicKnowledge?.nodes?.length) {
    topicSection = `\nTopic bank focus: ${topicId || topicKnowledge.topic}\n`;
  }

  const outputRule = `
Command: /wizard — Baseline script forge + question-bank router.

If the user has NOT yet answered life-detail questions:
- Ask exactly 3–4 cold, concrete life-detail questions (Chinese OK if user writes Chinese).
- Do NOT generate PEEL yet. Questions only.
- Density examples:
  1) 你上周最后一次和陌生人面对面聊超过5分钟是在哪？
  2) 你手机里最长连续刷短视频一次大概多久？什么App？
  3) 你家乡有没有一条小时候安静、现在被商场/高架盖掉的路？
  4) 你父母和你在付学费/选专业/找工作时最常吵架的具体场景是什么？

After the user answers:
1) Output 3–4 Universal Mother Scripts — each is one full PEEL block [P][E1][E2][L], E2 grounded in USER details.
2) Output 题库路由映射表 as markdown table:
   | 用户细节关键词 | 命中母题 | 推荐节点 | 可横向秒杀的题型举例 |
3) Optionally note Model A/B/C lean for each script.

No comfort. Scripts + routing only.
`;

  return `${BASE_SYSTEM}${MODELS_SECTION}${topicSection}${outputRule}`;
}
