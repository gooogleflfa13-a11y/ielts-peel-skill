# Workflow: /review

> 契约来源：`contracts/commands.json`（`name: review`，`runtimeCommand: score`，`aliases: ["score"]`，`deterministicStages: ["validate", "review"]`，`stateful: false`）

## 目的

对用户粘贴的 PEEL 段落做**确定性结构 + 输入感知的风险评审**：
不调用 LLM、不生成、不预测 band 分数。

## 输入

| 字段 | 必填 | 说明 |
|---|---|---|
| `input` | 是 | 带标签（`[P]/[E1]/[E2]/[L]`）或无标签的 4 行 PEEL 文本 |
| `prompt` | 否 | 原题文本（提供时启用 OFF_TOPIC_EVIDENCE 等输入感知检查） |

## 确定性阶段

1. **validate** — `parsePeelOutput(input)`（含 `parseLooseLines` 无标签后备）→
   `validatePeels(peels, { prompt })`：结构 5 项 + 语义 6 项检查。
2. **review** — `buildStructuralFeedback(parsed, validation)` 生成可读 issue
   列表（layer / code / evidence / action），并按 Writing（TR/CC/LR/GRA）或
   Speaking（FC/LR/GRA/PR）映射到官方评分维度的**代理反馈**
   （`criterionFeedback`，仅结构可推断项，明确标注为代理）。

## 输出契约

```json
{
  "status": "no_issues_detected | issues_found | unparseable",
  "checks": {
    "labels": "pass|fail",
    "layerBoundaries": "pass|fail",
    "e2Concreteness": "pass|fail",
    "linkClosure": "pass|fail",
    "bannedGlue": "pass|fail",
    "semanticQuality": "pass|fail"
  },
  "issues": [{ "layer": "P", "code": "P_CAUSAL_CHAIN", "evidence": "...", "action": "..." }],
  "disclaimer": "PEEL structure feedback only. Not an official IELTS assessment or band estimate."
}
```

## 不变量

- 无 LLM 调用（`requiresApiKey: false`）；
- 永不输出数字分数、band 估计、考官扮演；
- 每个响应都带 disclaimer。

## 相关实现

`server/skills/scoreSkill.js` · `server/evaluation/structuralFeedback.js` ·
`server/evaluation/criterionFeedback.js`
