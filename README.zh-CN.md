<img width="1200" alt="IELTS PEEL Hacker banner animation" src="banner.gif?20260727" />

# IELTS PEEL Hacker

**语言：** [English](./README.md) | 中文

[![CI](https://github.com/mixxmax/ielts-peel-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/mixxmax/ielts-peel-skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code%20license-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](./CHANGELOG.md)

IELTS PEEL Hacker 是一个开源论证训练工具，面向**雅思写作 Task 2** 与**口语 Part 3**。它把每个论点锁定为受约束的 `[P] -> [E1] -> [E2] -> [L]` 因果链，并用确定性的、可测试的质量门强制执行。

> 独立项目，与 IELTS、British Council、IDP 或 Cambridge University Press & Assessment 无隶属、背书关系。"IELTS" 仅用于描述考试语境。

当前仓库版本：**2.0.0**（已打 `v2.0.0` tag）。最新提交上所有质量指标均为绿。

---

## 目录

1. [产品是什么](#产品是什么)
2. [如何使用](#如何使用)
3. [命令参考](#命令参考)
4. [质量门与评估](#质量门与评估)
5. [架构](#架构)
6. [安全与隐私](#安全与隐私)
7. [开发](#开发)
8. [内容与许可](#内容与许可)
9. [文档索引](#文档索引)

---

## 产品是什么

仓库刻意区分三个交付面：

| 交付面 | 用途 | 实际提供 |
|---|---|---|
| [`skill/`](./skill/) | 可移植 Agent Skill | 一份 `SKILL.md` 协议 + 参考文件，兼容的 Agent 宿主（Claude、Grok、Cursor 等）加载即用 |
| `client/` + `server/` | 本地 BYOK playground | 可执行的 API/UI、确定性校验、安全边界、本地学习状态与自动化测试 |
| `packages/` | 可执行契约层 | `packages/core` 引擎库 + `packages/cli`（`peel-hacker` 命令），与 HTTP API 复用同一套单一真源实现 |

任何生成输出在到达用户之前，都必须通过**双层确定性质量门**（零 LLM token）。产品内置 320 项评估语料，七项指标在 `npm test` 中断言，质量不会静默退化。

## 如何使用

三种用法，按你的工作流选择。

### 1. 作为 Agent Skill（在 AI 对话中使用）

克隆仓库后，把 skill 安装到你的 Agent 宿主：

```bash
git clone https://github.com/mixxmax/ielts-peel-skill.git
cd ielts-peel-skill

# 通用文件系统宿主，项目内作用域
mkdir -p .agents/skills/ielts-peel-skill
cp -R skill/. .agents/skills/ielts-peel-skill/

# 或使用显式安装器
npm run install:skill:agents   # -> ~/.agents/skills/ielts-peel-skill
npm run install:skill:grok     # -> ~/.grok/skills/ielts-peel-skill
```

然后直接对话即可：`Some people think online education can replace traditional classrooms. Do you agree?`，或使用斜杠命令（`/peel`、`/matrix`、`/wizard`、`/score`、`/learn`）。

只想用裸协议、不装 skill 宿主时，把 [`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md) 粘贴进模型的 system-message 字段。

### 2. 作为本地 playground（Web UI + API）

要求：Node.js 20 或 22，npm 10+。

```bash
npm run bootstrap
npm run dev
```

- UI：<http://localhost:5173>
- API 健康检查：<http://localhost:3001/api/health>

浏览器接受 BYOK API key，发送给本地服务器；服务器只转发到配置好的 provider URL。key 保存在浏览器 `sessionStorage`（当前标签页会话）；不要在不可信或共享机器上使用 playground。

环境变量从进程环境读取（不自动加载 `.env`）：

```bash
APP_MODE=local \
PROVIDER_BASE_URL=https://api.openai.com/v1 \
CORS_ORIGINS=http://localhost:5173 \
npm run dev
```

完整配置与 API 参考：[`docs/SYSTEM_MANUAL.md`](./docs/SYSTEM_MANUAL.md)。

### 3. 作为 CLI（`peel-hacker`）

确定性命令不需要服务器、不需要 API key：

```bash
# 话题分类（支持复数："schools" -> Education）
npm run peel-hacker -- classify "Some people think schools should receive more investment."

# 确定性 PEEL 评审（结构+语义）；exit 0 = 干净，1 = 有问题
npm run peel-hacker -- review --prompt "community change" "<peel 文本>"
printf '%s' "<peel 文本>" | npm run peel-hacker -- review -    # 从 stdin 读取

# 通过 LLM 生成一个通过质检的 PEEL（需要 API key）
npm run peel-hacker -- generate "online education vs campus" --api-key sk-...

# 教师校准工具链（盲评导出 + kappa 分析）
npm run peel-hacker -- calibrate export --per-category 2 --seed 7
npm run peel-hacker -- calibrate import teacher-a.jsonl teacher-b.jsonl
```

`generate` 跑完整流水线（分类 -> 上下文 -> 生成 -> 双层质量门 -> 最多 1 次修复），输出不合格时以非零码退出。`calibrate` 是为评估语料做教师校准的准备工作，见[教师校准](#教师校准)。

## 命令参考

一个合法 PEEL 单元恰好四句、带标签：

```text
[P] 抽象立场或论断。
[E1] 单向因果机制。
[E2] 具体的人、地点、物品或可观察动作。
[L] 一句话回扣 P，不加新主张。
```

| 命令 | 输入 | 输出 |
|---|---|---|
| `/peel [prompt]` | 一条雅思 W2 / Part 3 问题 | 恰好 4 行英文 `[P][E1][E2][L]` + 一行中文 `底层逻辑` |
| `/matrix [phenomenon]` | 社会现象 | Model A/B/C 命中 + 基准 PEEL + 3 个横向秒杀 PEEL + 逻辑同构说明 |
| `/wizard [topic bank?]` | 空或话题关键词 | 首轮只问 3-4 个生活细节问题；回答后生成 3-4 个母脚本 PEEL + 路由表 |
| `/score [peel text]`（别名 `/review`） | 用户 PEEL（带标签或 4 行） | 确定性评审：labels、layerBoundaries、E2 具体性、linkClosure、bannedGlue、语义检查 |
| `/learn [mode]` | 问题 + 可选学生 PEEL | 学习循环：practice / hint / model / compare / revise |
| `/bank …` | 内部口语题库 | 本地专用能力，需 `ENABLE_PRIVATE_QUESTION_BANK=true` |

能力矩阵：

| 能力 | Agent Skill / 裸协议 | 本地 playground | 评估边界 |
|---|---:|---:|---|
| `/peel` 生成 | 有，模型执行 | 有，模型 + 解析 + 双层质量门 | 仅结构与论证展开 |
| `/matrix` 迁移练习 | 有，模型执行 | 有，模型 + 契约检查 | 启发式迁移辅助 |
| `/wizard` 个性化脚手架 | 有，宿主会话状态 | 有，显式状态机 | 用户细节是不可信输入 |
| `/score` `/review` | 提示词引导评审 | 确定性结构检查 | 非 IELTS 分数或 band 预测 |
| `/learn` | 依赖宿主 | 运行时实现 | 形成性反馈；未经考官校准 |
| `/bank` | 非授权公开产品 | 默认禁用 | 素材来源隔离，待权利核验 |

## 质量门与评估

运行时在返回任何生成输出前应用**双层确定性质量门**（零 LLM token）：

- **结构层**（`server/evaluation/validator.js`）：labels、layerBoundaries、E2 具体性（复数词干容错）、linkClosure、bannedGlue。
- **语义层**（`server/evaluation/semanticChecks.js`）：六条启发式规则，拦截无话题/荒谬论点、编造统计、实体堆砌、循环论证、绝对化群体归因、离题证据（输入感知）。

项目自建评估语料（[`evals/`](./evals/)）共 **320 项**，在 `npm test`（及 `node scripts/run-evals.mjs`）中锁定产品质量契约：

| 指标 | 阈值 | 当前值 |
|---|---|---|
| topicMacroF1 | ≥ 0.85 | 1.0 |
| validatorPrecision | — | 1.0 |
| validatorRecall | — | 1.0 |
| semanticFalseAcceptRate | ≤ 0.1 | 0.0 |
| revisionTargetResolutionRate | ≥ 0.85 | 0.907 |
| matrixContractAccuracy | ≥ 0.9 | 1.0 |
| wizardContractAccuracy | ≥ 0.9 | 1.0 |

### 教师校准

语料是项目自建合成数据。要从"自评满分"走向"教师评分"，仓库内置校准工具链（`peel-hacker calibrate export/import`）：导出盲评批次（不泄露预期标签）→ 请 2-3 位有资质的教师标注 → 导入标注，得到评测者间 Cohen's kappa、与合成标签的一致率、以及分歧条目清单。详见 [`evals/calibration/`](./evals/calibration/) 与 CLI 帮助。

## 架构

```text
Agent host ----------------------> skill/SKILL.md + references

Browser -> Express app -> request schema -> sanitize -> command registry
                                      -> command implementation
                                      -> parse + two-layer validate + one repair
                                      -> response schema -> browser

CLI / library  -> packages/cli (peel-hacker) -> packages/core -> same server modules
Contracts      -> contracts/commands.json + skill/references/workflows/*.md
```

关键单一真源：

- `server/commands/registry.js`：运行时命令注册表（命令的单一真源）。
- `Agent_System_Prompt.md`：生成 system-prompt 产物的来源。
- `contracts/commands.json`：公开命令契约（peel/matrix/review），引用 workflow 文档。
- `skill/`：可分发 skill 目录。
- `scripts/check-drift.mjs`：检查命令面、生成 prompt 与 contracts 文件保持一致。

仓库内 `.grok/` 树是开发镜像，不是第二产品源；用 `npm run sync:skill:repo-mirror` 显式重建，不要手改。

> Phase 0 之前的提案 [`docs/EVOLUTION_BLUEPRINT.md`](docs/EVOLUTION_BLUEPRINT.md) 仅作为**历史架构蓝图**保留，供决策留档。其中描述的 AI 考官、语义评分、数字分数与请求可控 provider 等设计均已废弃；现行产品契约以 `docs/SYSTEM_MANUAL.md` 与 `docs/superpowers/specs/` 下已批准的 Phase 0/1/2 规格为准。

## 安全与隐私

- 公开模式要求显式 CORS 白名单，并禁用本地记忆与私有题库能力。
- 请求体不能选择上游 provider URL。
- API key 会从结构化应用日志中移除。
- 无效生成输出永不作为成功结果返回（`quality_failed` 永不报告 `ok: true`）。
- 流式输出缓冲至校验完成。
- 本地学习数据可用 `GET /api/learner/export` 导出、`DELETE /api/learner/data` 清除。
- 本地 learner 标识不是认证机制。不要将本地记忆模式当作多租户公共服务暴露。

安全漏洞请按 [`SECURITY.md`](./SECURITY.md) 的流程报告；不要在 issue 中包含真实 API key、学习者数据或专有考试材料。

## 开发

```bash
# 三包可复现安装
npm run bootstrap

# 校验命令面 + 契约对齐
node scripts/check-drift.mjs

# 完整测试套件（386 个测试，含 eval 回归门）
npm test

# 评估报告；任一阈值未达标则非零退出
node scripts/run-evals.mjs

# 构建生成的 prompt 产物与客户端
npm run build
```

`npm run build` 只在仓库内写入。用户级 skill 安装始终是独立的显式命令。

贡献规则见 [`CONTRIBUTING.md`](./CONTRIBUTING.md) 与 [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)。

## 内容与许可

源代码基于 [MIT License](./LICENSE)。原创文档与示例、第三方名称、以及隔离的题库材料，其条款分别在 [`CONTENT_LICENSE.md`](./CONTENT_LICENSE.md) 与 [`NOTICE.md`](./NOTICE.md) 中说明。

标注为"从本地 PDF 题库提取"的题库文件**不受本项目再分发或商用许可**。在来源与权限记录完成前，必须将其排除在公开发布产物之外。不要提交复制的商业学习资料或回忆的真题内容。

## 文档索引

- [`docs/SYSTEM_MANUAL.md`](./docs/SYSTEM_MANUAL.md) — 系统手册（架构、模块、安全模型、API 参考、测试策略）
- [`docs/EVOLUTION_BLUEPRINT.md`](./docs/EVOLUTION_BLUEPRINT.md) — Phase 0 前历史蓝图（存档）
- [`docs/superpowers/specs/`](./docs/superpowers/specs/) — 已批准的 Phase 0/1/2 设计规格
- [`docs/superpowers/plans/`](./docs/superpowers/plans/) — Phase 实施计划
- [`CHANGELOG.md`](./CHANGELOG.md) — 版本历史
- [`PROJECT.md`](./PROJECT.md) — 中文项目简介
- [English README](./README.md)

> 重要提醒：它不是官方 IELTS 产品，也未获 British Council、IDP 或 Cambridge 背书；`/score`（别名 `/review`）与 criterion feedback 只做形成性结构反馈，不预测 Band 分数；生成输出须通过双层质量门，评估语料为自建合成数据、未经教师校准；来源仍在核验的题库不属于已授权公开产品，不得用于公开发行或商业用途。
