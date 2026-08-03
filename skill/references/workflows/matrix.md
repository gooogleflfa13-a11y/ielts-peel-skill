# Workflow: /matrix

> 契约来源：`contracts/commands.json`（`name: matrix`，`deterministicStages: ["classify", "context", "validate"]`，`stateful: false`）

## 目的

针对一个社会现象生成**归约模型 + 基准 PEEL + 3 个同构变体题 PEEL** 的
横向秒杀矩阵，并验证 6 个章节的完整性。

## 输入

| 字段 | 必填 | 说明 |
|---|---|---|
| `input` | 是 | 社会现象/母题关键词（≤ 5000 字符） |
| `apiKey` / `model` | 生成必需 | 上游 LLM 凭据与模型 |

## 确定性阶段

1. **classify** — `retrieveTopic(input)` 确定 9 母题；
   `matchReductionModel(input)` 匹配 A（世代差异）/ B（数字 vs 物理）/ C（过去 vs 现在），
   无匹配时显式返回 `Unknown`（不强制 Model C）。
2. **context** — 加载话题知识 + `models.json` 归约模型骨架。
3. **validate** — `evaluatePeelOutput(content, { minPeels: 4, maxPeels: 4, extraIssues: matrixContractIssues, prompt: input })`：
   - 双层 PEEL 质量门作用于全部 4 个 PEEL；
   - `matrixContractIssues`：命中模型 / 底层骨架 / 基准 PEEL / 题1-3 /
     逻辑同构说明 6 个章节完整性检查。

## 输出契约

```
## 命中模型
Model [A|B|C]: <一句选择理由>

## 底层骨架
- <机制要点>

## 基准 PEEL（对本现象）
[P]…[E1]…[E2]…[L]…

## 横向秒杀 ×3
### 题1: <变体>
[P]…[E1]…[E2]…[L]…
### 题2: …
### 题3: …

## 逻辑同构说明
<一句中文：4 个 PEEL 共用同一底层机制>
```

所有 PEEL 的 E2 场景必须与 `prompt` 话题一致（OFF_TOPIC_EVIDENCE 检查）。

## 失败策略

同 /peel：最多 1 次修复，再失败 `quality_failed`。

## 相关实现

`server/skills/matrixSkill.js` · `server/evaluation/outputQuality.js#matrixContractIssues`
