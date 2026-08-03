# Workflow: /peel

> 契约来源：`contracts/commands.json`（`name: peel`，`deterministicStages: ["classify", "context", "validate"]`，`stateful: false`）

## 目的

为一条 IELTS Writing Task 2 / Speaking Part 3 问题生成**恰好一个**锁定
`[P]-[E1]-[E2]-[L]` 段落，并让它通过可执行的双层质量门。

## 输入

| 字段 | 必填 | 说明 |
|---|---|---|
| `input` | 是 | 作文/口语问题文本（≤ 5000 字符） |
| `history` | 否 | 对话历史（≤ 12 轮） |
| `apiKey` / `model` | 生成必需 | 上游 LLM 凭据与模型 |

## 确定性阶段

1. **classify** — `topicRetriever.retrieveTopic(input)`：9 母题分类
   （词边界 + 词干容错，如 `schools`→Education）。
2. **context** — 加载 `topics/<topicId>.json` 话题知识 + `e2-entities.json`
   实体库，注入生成上下文（E2 燃料按记忆信任层级放在 user message 层）。
3. **validate** — 双层质量门 `evaluatePeelOutput(content, { minPeels: 1, maxPeels: 1, prompt: input })`：
   - 结构层（`validator.js`）：labels、layerBoundaries、e2Concreteness、
     linkClosure、bannedGlue；
   - 语义层（`semanticChecks.js`）：P_TOPIC_ANCHOR、UNSUPPORTED_ATTRIBUTION、
     ENTITY_PILE、CIRCULAR_MECHANISM、ABSOLUTE_GROUP_CLAIM、OFF_TOPIC_EVIDENCE。

## 输出契约

```
[P] 抽象立场（无因果链、无例子）
[E1] 单向机制（不出现具体人物/场所）
[E2] 一个具体人物/地点/物品 + 可观察动作（至少 1 个实体指标）
[L] 回扣 P（closing cue + 词项重叠），不加新主张
---
底层逻辑：母题 · 节点 · 模板名 · E2实体名
```

## 失败策略

- 质量门未过：`buildRepairInstruction(issues)` 触发 **最多 1 次** 修复；
- 修复后仍失败：`status: quality_failed`，永不返回 `ok: true`。

## 相关实现

`server/skills/peelSkill.js` · `server/pipeline/executeCommand.js`（stream 分支）
