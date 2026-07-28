<img width="1200" alt="IELTS PEEL Hacker banner animation" src="banner.gif?20260727" />

# IELTS PEEL Hacker

**Stop memorizing. Start hacking.**  
A cold forensic logic engine that locks every IELTS argument into `[P]->[E1]->[E2]->[L]` - then teaches you to write, revise, and improve through a structured learning loop.  
*Agent Skill · System Prompt · Local Playground*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

<p align="center">
  <a href="#english"><strong>English</strong></a> ·
  <a href="#中文"><strong>中文</strong></a> ·
  <a href="#whats-new"><strong>What's New</strong></a>
</p>

---

<a id="whats-new"></a>

## What's New (v2.0 - 2026-07-27)

This release rebuilds the trust foundation, unifies the architecture, and adds a complete learning loop.

### Phase 0: Trust Foundation
- **Provider lock**: API keys can no longer be forwarded to arbitrary URLs
- **Stateless public mode**: no shared memory between anonymous users
- **Fail-closed quality gate**: invalid output is never labeled "passed"
- **Safe streaming**: rejected content is never shown to users
- **Structural feedback only**: `/score` no longer impersonates an IELTS examiner
- **Bank gated by default**: question bank requires explicit local opt-in

### Phase 1: Unified Architecture
- **Single command registry**: all surfaces derive from one source of truth
- **Typed schemas**: every request validated before execution
- **Unified pipeline**: sync and streaming share one execution core
- **Wizard state machine**: explicit phases instead of LLM guessing
- **Topic routing fix**: word-boundary matching, Unknown result, confidence scores
- **Memory trust tier**: learner data is quoted untrusted input, never system instructions
- **Drift check**: automated verification that docs match code

### Phase 2: Learning Product
- **Learner onboarding**: test type, target band, current level, exam date, language
- **5 learning modes**: `practice` (write first), `hint` (scaffold), `model` (reference), `compare` (side-by-side), `revise` (re-score)
- **Criterion feedback**: Writing TR/CC/LR/GRA, Speaking FC/LR/GRA/PR - no band prediction
- **Versioned attempts**: every draft + feedback + revision saved, append-only
- **Privacy controls**: `DELETE /api/learner/data`, `GET /api/learner/export`
- **Writing/Speaking separation**: mode-appropriate prompts and expectations
- **Accessibility**: labels, live regions, keyboard navigation, reduced-motion

### Test Coverage
335 tests across 38 files. Zero vulnerabilities. Drift-clean.

---

<a id="english"></a>

## English

### 30-Second Overview

| What you need | Where to go |
|---------------|-------------|
| **Install as an Agent Skill (recommended)** | [`skill/SKILL.md`](./skill/SKILL.md) |
| **Paste as System Prompt into any LLM** | [`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md) |
| **Run the local BYOK playground (optional)** | `client/` + `server/` stack |

### Commands

| Command | Input | Output |
|---------|-------|--------|
| `/peel <prompt>` | IELTS W2 / Part 3 question | 4 English lines `[P][E1][E2][L]` + 1 Chinese `底层逻辑` line |
| `/matrix <phenomenon>` | Social phenomenon | Model A/B/C match + base PEEL + 3 sibling kills |
| `/wizard [topic]` | Empty or topic keywords | First: life-detail questions. After answers: mother scripts |
| `/score <peel text>` | User PEEL (labeled or 4 lines) | PEEL Structure Review: labels, boundaries, E2 concreteness, closure, banned glue |
| `/learn <mode> [prompt]` | Learning mode + prompt | See below |
| `/bank <subcommand>` | Internal speaking warehouse | Local-only; requires explicit `ENABLE_PRIVATE_QUESTION_BANK=true` |

### `/learn` - The Learning Loop

| Mode | What happens | API Key |
|------|-------------|---------|
| `/learn practice <prompt>` | You write first, then get structural + criterion feedback | No |
| `/learn hint <prompt>` | AI gives scaffolding questions, not the answer | No |
| `/learn model <prompt>` | AI generates a PEEL tagged as model answer | Yes |
| `/learn compare <prompt>` | Your version + AI version side-by-side with diff | Yes |
| `/learn revise <attemptId>` | Load a prior attempt, edit, re-score | No |

**Criterion feedback** covers official IELTS dimensions:
- **Writing**: Task Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy
- **Speaking**: Fluency & Coherence, Lexical Resource, Grammar, Pronunciation

Every feedback response includes: *"PEEL structure feedback only. Not an official IELTS assessment or band estimate."*

### PEEL Layer Physics

| Layer | Altitude | Job | Ban |
|-------|----------|-----|-----|
| **P** | Satellite | Abstract verdict | Examples, causal chains |
| **E1** | Drone | Unidirectional mechanism A -> B | Concrete entities |
| **E2** | Microscope | Physical entity strike | Pure abstraction |
| **L** | Return | One-sentence seal back to P | New claims |

### Quick Install

#### A) Copy the Skill package (Grok / Claude Code / Cursor)
```bash
git clone https://github.com/gooogleflfa13-a11y/ielts-peel-skill.git
cd ielts-peel-skill

# User-wide
cp -R skill ~/.grok/skills/ielts-peel-skill
# or
cp -R skill ~/.agents/skills/ielts-peel-skill

# Project-scoped
mkdir -p .grok/skills && cp -R skill .grok/skills/ielts-peel-skill
```

Invoke: `/ielts-peel-skill` or natural language like "用 PEEL 写这道雅思大作文".

#### B) Raw System Prompt (any LLM)
Open [`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md) and paste the full content into the System field.

#### C) Local Playground (developers)
```bash
npm run install:all
npm run dev
```

### Repository Map
```
ielts-peel-skill/
├── skill/                    # Product (portable skill package)
├── server/
│   ├── commands/registry.js  # Single source of truth for all commands
│   ├── pipeline/             # Unified execution core
│   ├── schemas/              # Typed request/response validation
│   ├── learner/              # Profile, attempts, learn skill
│   ├── evaluation/           # Validator, criterion feedback, structural feedback
│   ├── wizard/               # Explicit state machine
│   ├── memory/               # MemoryStore boundary (null + local)
│   ├── prompts/              # Writing/Speaking prompt builders
│   └── api/                  # Learner privacy routes
├── client/                   # Playground UI (React + Vite + Tailwind)
├── tests/                    # 335 tests (unit + integration)
├── scripts/check-drift.mjs   # Doc-code drift verification
└── docs/                     # Architecture + audit reports
```

---

<a id="中文"></a>

## 中文

### 核心理念

雅思大作文和口语 Part 3 的本质是 **用英语执行逻辑论证**，不是背 GRE 词、堆 `Furthermore / Moreover / In conclusion`。

这套脚手架重点检查一件事：

> **句子之间有没有真正的因果链条？**

PEEL Hacker 把观点编码成四层可执行结构：

| 层 | 名称 | 海拔 | 一句话职责 |
|----|------|------|------------|
| **P** | Point | 卫星 | 抽象定调：这是什么性质的问题？ |
| **E1** | Explanation | 无人机 | 机制：A 如何一步步导致 B？ |
| **E2** | Example | 显微镜 | 物理实体：看得见摸得着的证据 |
| **L** | Link | 返航 | 一句话扣回 P，不引入新信息 |

硬约束（Skill 内强制执行）：

- 每一段 PEEL **恰好四句**，标签为 `[P] [E1] [E2] [L]`
- 标签必须按顺序出现，不可重复、缺失或乱序
- 禁止散文胶水：`First of all` / `In conclusion` / `On the one hand` 等
- 9 大母题检索：教育 · 科技 · 环境 · 犯罪 · 政府 · 媒体 · 城市化 · 社会 · 健康

---

## 安装 Skill（产品交付）

### 方式 A - 复制 Skill 包（Grok / Claude Code / Cursor 等）

```bash
git clone https://github.com/gooogleflfa13-a11y/ielts-peel-skill.git
cd ielts-peel-skill

# 用户级（本机全局）
cp -R skill ~/.grok/skills/ielts-peel-skill
# 或
cp -R skill ~/.agents/skills/ielts-peel-skill

# 项目级
mkdir -p .grok/skills && cp -R skill .grok/skills/ielts-peel-skill
```

调用示例：

```text
/ielts-peel-skill
/peel Some people think online education can replace traditional classrooms.
/matrix community relationships are weaker than in the past
/wizard 教育+科技题库
/learn practice Some people think online education can replace traditional classrooms.
```

自然语言同样可以触发，例如：「用 PEEL 爆破这道雅思大作文」。

### 方式 B - 纯 System Prompt（任意 LLM）

1. 打开 [`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md)
2. 全文复制到 ChatGPT / Claude / DeepSeek / 硅基流动 等 **System** 字段
3. 用户消息直接发题目或 `/peel` `/matrix` `/wizard` `/learn`

### 方式 C - 本地 Playground

```bash
npm run install:all
npm run dev
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 | http://localhost:3001 |

---

## 指令与输出成果

| 指令 | 一句话产物 | 典型场景 |
|------|------------|----------|
| `/peel` | 1 段 4 句英文 PEEL + 1 行中文底层逻辑 | 大作文 body / 口语 Part 3 单题 |
| `/matrix` | 1 个模型 + 基准 PEEL + 3 道同类题秒杀 | 一类题批量准备 |
| `/wizard` | 先追问细节 -> 3-4 套「你的」母剧本 + 路由表 | 口语地基 / 个人素材库 |
| `/score` | 确定性结构反馈（标签 / 分层 / E2 实体 / 回扣 / 禁用词） | 修改自己写的 PEEL，不提供官方评分 |
| `/learn` | 5 种学习模式：先练后评 / 提示 / 范文 / 对比 / 修改重评 | 从抄答案到真正练习 |
| `/bank` | 本地显式启用后抽题 / 横纵图 / PEEL | 私有本地题仓训练，公开模式禁用 |

---

### `/learn` - 学习闭环（v2.0 新增）

不再只是"你问我答"。`/learn` 让你**先练、再看、对比、修改、进步**。

| 模式 | 流程 | 需要 API Key |
|------|------|-------------|
| `practice` | 你先写 PEEL -> 获得结构 + 官方维度反馈 -> 保存为尝试记录 | 否 |
| `hint` | AI 给脚手架问题，不给答案 | 否 |
| `model` | AI 生成 PEEL 范文（标记为 model answer） | 是 |
| `compare` | 你的版本 + AI 范文并排对比 + 差异分析 | 是 |
| `revise` | 加载之前的尝试 -> 修改 -> 重新评分 -> 追加到版本历史 | 否 |

**官方维度反馈**（不预测分数）：

- **写作**: 任务回应 (TR) · 连贯衔接 (CC) · 词汇 (LR) · 语法 (GRA)
- **口语**: 流利度 (FC) · 词汇 (LR) · 语法 (GRA) · 发音 (PR)

每次反馈都包含声明：*"PEEL structure feedback only. Not an official IELTS assessment or band estimate."*

**Onboarding**: 首次使用时收集你的考试类型、目标分数、当前水平、考试日期、语言偏好，让反馈更有针对性。

**版本化尝试**: 每次练习的原文、反馈、修改稿都保存下来，可以追溯进步轨迹。

**隐私控制**:
- `DELETE /api/learner/data` - 删除你的所有数据
- `GET /api/learner/export` - 导出你的所有数据

---

### `/peel` - 单点逻辑爆破

**你输入**

```text
/peel Some people think online education can replace traditional classrooms.
To what extent do you agree or disagree?
```

**你得到**

```text
[P] The most compelling argument for preserving physical attendance lies in
the fact that online education inherently weakens the socialization function
of schooling.

[E1] Fundamentally, education is not merely information transfer - it is the
process where young people internalize social norms through peer-to-peer
dynamics, a mechanism that digital platforms structurally cannot replicate.

[E2] This is particularly evident in university seminar rooms, where students
build affinity by working together on interactive whiteboards, navigating
spontaneous disagreements, and forming impromptu study groups after class.

[L] Therefore, the physical classroom's irreplaceable role in cultivating
social capital makes full replacement by digital alternatives impossible.

---
底层逻辑：教育母题 · 社会与情感节点 · 缺失模型 · E2: university seminar rooms / interactive whiteboards
```

---

### `/score` - PEEL 结构反馈

**你输入**

```text
/score
[P] Online education is bad because students do not talk and this leads to
weak skills and also for example they stay at home.
[E1] It is bad for society.
[E2] Research shows social skills are important for people in society.
[L] In conclusion, this is a serious issue and governments should act and
build more schools and also improve the internet.
```

**你得到（示意）**

```text
PEEL STRUCTURE REVIEW: REVISE
Labels: PASS · Layer boundaries: FAIL · E2 concreteness: FAIL
Link closure: FAIL · Banned glue: FAIL

Evidence: E2 lacks a concrete physical entity.
Revise: add a specific person, place, object, or observable action to E2.

PEEL structure feedback only. Not an official IELTS assessment or band estimate.
```

Playground 下 `/score` **可不填 API Key**（程序化质检）。

---

### `/matrix` - 降维打穿器

```text
/matrix community relationships are weaker than in the past
```

输出：命中模型 + 底层骨架 + 基准 PEEL + 3 道横向秒杀题 + 逻辑同构说明。

| 模型 | 名称 | 适用输入举例 |
|------|------|----------------|
| **A** | 代际 Young vs Old | 老人用不用 App、年轻人购物习惯 |
| **B** | 物理 vs 虚拟 | 网课能否取代教室、网购 vs 实体店 |
| **C** | 过去 vs 现在 | 社区变淡、安静地方变少、沟通方式变了 |

匹配不到时返回 `Unknown`，不再硬塞模型。

---

### `/wizard` - 基准剧本生成器

第 1 轮只追问生活细节（不写 PEEL），第 2 轮根据你的回答生成 3-4 套个人母剧本 + 路由表。E2 来自**你的生活**，不是背范文。

使用显式状态机控制流程：
- `AWAITING_DETAILS`：只问问题，不持久化
- `READY_TO_GENERATE`：收到答案后生成脚本

---

## 思维方式指南

1. **先归母题，再写理由** - 9 个抽屉调取节点，不是空想
2. **P 要抽象到有方向，但不能空** - 禁止在 P 里写 E1
3. **E1 强制 `A -> [中间齿轮] -> B`** - 禁止同义反复
4. **E2 物理到毛孔** - `people` -> `kindergarteners in underfunded rural public schools`
5. **先练后看** - 用 `/learn practice` 自己先写，再看 model 和反馈

完整协议与词库：[`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md)。

---

## 仓库结构

```text
ielts-peel-skill/
├── skill/                            # 产品本体
│   ├── SKILL.md                      # Agent 入口
│   └── references/
│       ├── SYSTEM_PROMPT.md          # 完整系统协议
│       ├── e2-entities.json          # E2 实体库
│       ├── models.json               # 三大降维模型
│       └── keywords.json             # 母题关键词
├── server/
│   ├── commands/registry.js          # 命令注册表（单一真源）
│   ├── pipeline/executeCommand.js    # 统一执行管线
│   ├── schemas/                      # 类型化请求/响应校验
│   ├── learner/                      # 学习模块（profile + attempts + learn）
│   ├── evaluation/                   # 质检（validator + criterion + structural）
│   ├── wizard/wizardState.js         # Wizard 状态机
│   ├── memory/memoryStore.js         # 记忆边界（null + local）
│   ├── prompts/                      # 写作/口语 Prompt 构建器
│   ├── api/learnerRoutes.js          # 隐私 API
│   └── knowledge/                    # 9 母题知识 + 题库
├── client/                           # Playground UI
│   └── src/components/
│       ├── Onboarding.jsx            # 学生 Onboarding
│       ├── LearnPanel.jsx            # 学习模式面板
│       ├── CriterionFeedback.jsx     # 官方维度反馈
│       └── ...
├── tests/                            # 335 测试（unit + integration）
├── scripts/check-drift.mjs           # 文档-代码漂移检查
├── docs/
│   ├── QUALITY_AUDIT_2026-07-26.md   # 质量审计报告（EN）
│   ├── QUALITY_AUDIT_2026-07-26.zh-CN.md  # 质量审计报告（CN）
│   └── EVOLUTION_BLUEPRINT.md        # Historical architecture blueprint (obsolete product claims)
└── README.md
```

---

## 开发与同步

```bash
# 改 Agent_System_Prompt.md 后，同步到 skill + systemPrompt.js
npm run sync:skill
npm run build:prompt

# 漂移检查（文档与代码一致性）
node scripts/check-drift.mjs

# 单测
npm test

# 构建
npm run build
```

---

## 安全

| 项 | 说明 |
|----|------|
| **Provider 锁定** | API Key 只发送到服务器配置的地址；浏览器无法指定 provider URL |
| **公开无状态** | 公开模式不保存任何用户记忆；本地模式需显式开启 |
| **记忆信任分层** | 用户数据作为引用材料注入用户消息，不进入系统提示词 |
| **Fail-closed 质量门** | 解析或验证失败时返回 `QUALITY_FAILED`，绝不假充合格 |
| **安全流式** | 先在后台验证通过再显示；断连立即取消 |
| **隐私控制** | `DELETE /api/learner/data` 删除所有数据；`GET /api/learner/export` 导出 |
| **题库隔离** | 公开模式禁用 `/bank`；本地需显式 `ENABLE_PRIVATE_QUESTION_BANK=true` |
| **CORS 白名单** | 生产环境必须配置明确的来源白名单 |
| **限速** | 基于 `req.ip`，不信任伪造的 `X-Forwarded-For` |
| **错误信息** | 公开错误不包含 provider URL、响应体、API Key 或堆栈 |

---

## License

MIT - 见 [`LICENSE`](./LICENSE)。
