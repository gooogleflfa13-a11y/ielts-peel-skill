<img width="1376" height="768" alt="Generated Image July 21, 2026 - 3_57PM" src="https://github.com/user-attachments/assets/77705c5a-4016-4aae-b7cd-dfa7114a718b" />

# IELTS PEEL Hacker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

<p align="center">
  <a href="#english"><strong>🇬🇧 English</strong></a> ·
  <a href="#中文"><strong>🇨🇳 中文</strong></a>
</p>

---

<a id="english"></a>

## English

> **The product is the Skill** — a cold logic engine for IELTS Writing Task 2 body paragraphs and Speaking Part 3.  
> Generates locked `[P] → [E1] → [E2] → [L]` causal arguments instead of piling up discourse glue.

### 30-Second Overview

| What you need | Where to go |
|---------------|-------------|
| **Install as an Agent Skill (recommended)** | [`skill/SKILL.md`](./skill/SKILL.md) |
| **Paste as System Prompt into any LLM** | [`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md) |
| **Run the local BYOK playground (optional)** | `client/` + `server/` stack |

```
                  ┌─────────────────────────┐
                  │   IELTS PEEL Hacker      │
                  │   = Skill / System Prompt │
                  └───────────┬─────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
  /peel single-shot    /matrix cross-kill    /wizard mother script
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                optional: BYOK web playground
```

### Commands

| Command | Input | Output |
|---------|-------|--------|
| `/peel <prompt>` | IELTS W2 / Part 3 question | 4 English lines `[P][E1][E2][L]` + 1 Chinese `底层逻辑` line |
| `/matrix <phenomenon>` | Social phenomenon | Model A/B/C match + base PEEL + 3 sibling kills |
| `/wizard [topic]` | Empty or topic keywords | First: life-detail questions. After answers: mother scripts |
| `/score <peel text>` | User PEEL (labeled or 4 lines) | Cold quality checklist: layer boundaries, banned glue, E2 physicality |
| `/bank <subcommand>` | Internal speaking warehouse | random / search / links / peel / stats |

### Core Philosophy

IELTS Writing Task 2 and Speaking Part 3 are **exercises in causal logic**, not vocabulary display. Examiners score one thing:

> **Does each sentence causally follow from the previous one?**

PEEL Hacker encodes every argument as four locked layers:

| Layer | Altitude | Job |
|-------|----------|-----|
| **P** | Satellite | Abstract verdict — what kind of problem is this? |
| **E1** | Drone | Causal mechanism — how does A lead to B? |
| **E2** | Microscope | Physical entity strike — tangible evidence |
| **L** | Return | One-sentence seal back to P, no new info |

**Hard constraints (enforced by the skill):**
- Exactly 4 labeled sentences `[P][E1][E2][L]`
- No banned glue: `First of all`, `In conclusion`, `On the one hand`, etc.
- 9 mother-topic routing: Education · Technology · Environment · Crime · Government · Media · Urbanization · Society · Health

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
See the [中文 section](#仓库结构) for the full tree, or run:
```bash
/usr/local/bin/npm run install:all
/usr/local/bin/npm run dev
```

### Repository Map
```
ielts-peel-skill/
├── skill/               # ★ Product (portable skill package)
├── .grok/skills/        #   Project Skill mirror
├── server/              #   Optional API + structured knowledge
├── client/              #   Optional playground UI
├── tests/               #   Integration + unit tests
└── docs/                #   Architecture blueprint
```

See full details in the [中文 section](#中文) below.

---

<a id="中文"></a>

## 中文

## 核心理念

雅思大作文和口语 Part 3 的本质是 **用英语执行逻辑论证**，不是背 GRE 词、堆 `Furthermore / Moreover / In conclusion`。

考官真正在看的只有一件事：

> **句子之间有没有真正的因果链条？**

PEEL Hacker 把观点编码成四层可执行结构：

| 层 | 名称 | 海拔 | 一句话职责 |
|----|------|------|------------|
| **P** | Point | 卫星 | 抽象定调：这是什么性质的问题？ |
| **E1** | Explanation | 无人机 | 机制：A 如何一步步导致 B？ |
| **E2** | Example | 显微镜 | 物理实体：看得见摸得着的证据 |
| **L** | Link | 返航 | 一句话扣回 P，不引入新信息 |

**Hacker = 拆因果链，不是润色语言。**

硬约束（Skill 内强制执行）：

- 每一段 PEEL **恰好四句**，标签为 `[P] [E1] [E2] [L]`
- 禁止散文胶水：`First of all` / `In conclusion` / `On the one hand` 等
- 9 大母题检索：教育 · 科技 · 环境 · 犯罪 · 政府 · 媒体 · 城市化 · 社会 · 健康

---

## 安装 Skill（产品交付）

### 方式 A — 复制 Skill 包（Grok / Claude Code / Cursor 等）

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
```

自然语言同样可以触发，例如：「用 PEEL 爆破这道雅思大作文」。

### 方式 B — 纯 System Prompt（任意 LLM）

1. 打开 [`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md)  
2. 全文复制到 ChatGPT / Claude / DeepSeek / 硅基流动 等 **System** 字段  
3. 用户消息直接发题目或 `/peel` `/matrix` `/wizard`

### 方式 C — 本仓库已内置

| 路径 | 说明 |
|------|------|
| `skill/` | 可移植产品包 |
| `.grok/skills/ielts-peel-skill/` | 仓库内 Grok Skill |
| `Agent_System_Prompt.md` | System Prompt 源文件（改完后 `npm run sync:skill`） |

---

## 指令与输出成果展示

> 下面每条指令都按 **你输入什么 → 你得到什么** 展示。  
> 输出为示意（真实生成会随模型略有措辞差异，但结构锁死不变）。

| 指令 | 一句话产物 | 典型场景 |
|------|------------|----------|
| `/peel` | 1 段 4 句英文 PEEL + 1 行中文底层逻辑 | 大作文 body / 口语 Part 3 单题 |
| `/matrix` | 1 个模型 + 基准 PEEL + 3 道同类题秒杀 | 一类题批量准备 |
| `/wizard` | 先追问细节 → 3–4 套「你的」母剧本 + 路由表 | 口语地基 / 个人素材库 |
| `/score` | 质检报告（缺层 / 禁用词 / E2 是否物理） | 批改自己写的 PEEL |
| `/bank` | 抽题 / 横纵图 / 隐式取题再 PEEL | 口语当季题仓训练 |

---

### `/peel` — 单点逻辑爆破

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

[E1] Fundamentally, education is not merely information transfer — it is the
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

**读产物时看什么**

| 行 | 应看到 | 不应看到 |
|----|--------|----------|
| P | 抽象定性 | 具体例子、长因果链 |
| E1 | A→中间齿轮→B | 教室/白板等实体名词堆砌 |
| E2 | 人/地/物/动作画面 | 空词 people / society |
| L | 一句话扣回 P | 新论点 |

---

### `/matrix` — 降维打穿器

**你输入**

```text
/matrix community relationships are weaker than in the past
```

**你得到（结构示意）**

```text
## 命中模型
Model C: 过去 vs 现在 — 城市化 + 数字化的双重挤压

## 底层骨架
- 过去：tight-knit neighborhoods → spontaneous face-to-face help
- 现在：high-rise living + short-form video saturation → isolated dwellers
- 不变机制：物理邻近密度 ≠ 心理连接密度（甚至成反比）

## 基准 PEEL
[P] Local communities were far stronger in the past.
[E1] Tight-knit neighborhoods once forced frequent spontaneous interaction;
     urbanization and digital distraction now isolate city dwellers.
[E2] A generation ago, neighbors borrowed sugar and watched each other's kids;
     now people in the same apartment building do not even know each other's names.
[L] So the erosion of societal cohesion is undeniable.

## 横向秒杀 ×3
### 题1: Were communities stronger in the past?
[P]... [E1]... [E2]... [L]...

### 题2: Why don't city neighbors know each other?
[P]... [E1]... [E2]... [L]...

### 题3: Is technology making us more or less connected?
[P]... [E1]... [E2]... [L]...

## 逻辑同构说明
三题共用机制「物理居住密度与心理连接密度的反比」；仅 E2 场景从邻里
换成电梯间陌生人 / 短视频沉迷 / 远程办公。
```

**三大模型速查**

| 模型 | 名称 | 适用输入举例 |
|------|------|----------------|
| **A** | 代际 Young vs Old | 老人用不用 App、年轻人购物习惯 |
| **B** | 物理 vs 虚拟 | 网课能否取代教室、网购 vs 实体店 |
| **C** | 过去 vs 现在 | 社区变淡、安静地方变少、沟通方式变了 |

---

### `/wizard` — 基准剧本生成器

**第 1 轮 — 你输入**

```text
/wizard 教育+科技
```

**第 1 轮 — 你得到（只追问，不写 PEEL）**

```text
1. 你上周最后一次和陌生人面对面聊超过 5 分钟是在哪？（地铁 / 食堂 / 无）
2. 你手机里最长一次连续刷短视频大概多久？什么 App？
3. 你家乡有没有一条小时候安静、现在被商场或高架盖掉的路？
4. 你和父母在选专业 / 付学费时最常吵架的具体场景是什么？
```

**第 2 轮 — 你回答（示例）**

```text
1. 几乎没有，都是外卖骑手交接
2. 抖音连续刷了 90 分钟
3. 有，原来的河边步道现在是购物中心停车场
4. 高考后爸妈逼着报会计，我在客厅摔了志愿表
```

**第 2 轮 — 你得到（结构示意）**

```text
## 母剧本 ×3

### 剧本 1 — 物理在场 vs 虚拟（教育/科技）
[P] Purely digital learning erodes the socialization core of education.
[E1] Screens filter out micro-expressions and peer negotiation drills that
     build real-world cooperation.
[E2] After a 90-minute Douyin session alone in a bedroom, there is no
     post-class argument at a whiteboard — only the next push notification.
[L] So physical peer dynamics remain non-negotiable for holistic learning.

### 剧本 2 — 过去 vs 现在（城市化）
[P] Quiet public space has been displaced by commercial sprawl.
[E1] ...
[E2] The riverside walk of childhood is now a shopping-mall parking lot...
[L] ...

### 剧本 3 — 代际 / 教育经济节点
[P] ...
[E2] Smashing the college application form on the living-room table...
...

## 题库路由映射表
| 你的细节           | 命中母题     | 可横向秒杀题型           |
|--------------------|--------------|--------------------------|
| 抖音 90 分钟       | 科技/健康    | 手机是否让人孤独         |
| 河边→停车场        | 城市化/环境  | 安静的地方是否变少       |
| 摔志愿表           | 教育/社会    | 父母是否应决定专业       |
```

**产品点**：E2 来自**你的生活**，不是背范文；3–4 个剧本可覆盖 Part 2 叙事地基 + 大量 Part 3 / 作文变体。

---

### `/score` — PEEL 质检

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
⚠ QUALITY GATE
structure: 1.0 | layers: 0.25 | physical: 0.0

• Banned discourse glue detected: /\bin conclusion\b/i
• P contains "for example"
• P has excessive causal chains — keep abstract
• E1 contains concrete entities — move to E2   (若适用)
• ⚠️ E2 lacks ANY physical entity — add person/place/object/action
• L is too long — should be one sentence max
```

**对比：合格样例会被标成** `✓ QUALITY PASS`（无禁用连接词、E2 有 seminar room / whiteboard 等实体）。

Playground 下 `/score` **可不填 API Key**（程序化质检）。

---

### `/bank` — 内嵌题库底仓

口语题已嵌入数据平面（`server/knowledge/question-bank/`、`skill/references/question-bank/`），  
**不是**用户下载的 PDF，而是抽题 / 关联 / 作答时的隐藏材料仓。

| 子命令 | 作用 | API Key |
|--------|------|---------|
| `random [p1\|p2\|p3] [kw]` | 智能随机出题 | 否 |
| `search <kw>` | 检索话题 | 否 |
| `links <ref\|kw>` | 横纵联系 | 否 |
| `peel <ref\|kw>` | 隐式取题 → PEEL | 是 |
| `stats` | 底仓规模 | 否 |

#### 例 A — 随机抽 P2

**输入**

```text
/bank random p2 traffic
```

**输出**

```text
## DRAW
Part: P2 · Mother: Urbanization · ref:`p2_be3ba24f04`

**Prompt**
Describe a time when you were stuck in a traffic jam for a very long time

**Cue bullets**
- When it happened
- Where you were stuck
- What you did while waiting
- And explain how you felt in the traffic jam

**P3 teaser**
- How can we solve the traffic jam problem?
- Do you think developing public transport can solve traffic jam problems?

---
Next: /bank peel p2_be3ba24f04 · /bank links p2_be3ba24f04
```

#### 例 B — 横纵联系

**输入**

```text
/bank links 交通拥堵
```

**输出（示意）**

```text
## LINK MAP
Focus: **交通拥堵** (P2) · Mother: Urbanization · ref:`p2_…`

### 横向 Horizontal — 同母题可迁移
- P1 · Cars — Are there tall buildings near…（同属城市/交通簇）
- P2 · 高建筑 / 通勤类话题 — 共用「空间压缩 / 动脉阻塞」节点

### 纵向 Vertical — P1 热身 ↔ P2/P3 深挖
- P1 可先练 Cars / Building
- P3 可升维到 public transport / congestion policy（直接 /peel）

### PEEL route
- Mother: Urbanization
- Try: /bank peel <ref> 或 /peel How can we solve traffic jams?
```

#### 例 C — 底仓隐式取题并作答

**输入**

```text
/bank peel traffic jam
```

**输出**：先锁定仓库里的 P2/P3 题干（不甩整本 PDF），再附上标准 `[P][E1][E2][L]` + 底层逻辑（同 `/peel` 形态）。

当前嵌入规模（2026-05~08 口语仓）：Part1 话题 40+ · Part2 话题 60+ · 含 P3 链与母题路由。

---

## 思维方式指南

> 带着这 5 条用 Skill，否则你会把它用成花哨翻译器。

1. **先归母题，再写理由** — 9 个抽屉调取节点，不是空想  
2. **P 要抽象到有方向，但不能空** — 禁止在 P 里写 E1  
3. **E1 强制 `A → [中间齿轮] → B`** — 禁止「污染对环境不好」式同义反复  
4. **E2 物理到毛孔** — `people` → `kindergarteners in underfunded rural public schools` 你可能会认为E1和E2之间有某种断层，但事实上也是如此，E1可以仍然做一般化的解释，比如‘人们从农村移居到城市对孩子的成长是不利的，因为【这会让孩子们找不到玩伴/没有活动空间】’，在E2就要针对来举例，将【孩子】【没有玩伴】【没有活动空间】用实际的例子举出来，比如【孩子】细化为【伴随父母来到城市的孩子】，【没有玩伴】细化为【一起上学的孩子们通常不是来自同一个小区的同一栋楼】【没有活动空间】细化为【城市建设没有留足儿童活动的玩具，空间被停车场占据】，你举的什么例子不重要，即便是胡说也没有任何关系，甚至是你自己觉得有道理都可以。 
5. **口语 Part 3 = 写作 Task 2 同一骨架** — 只换语气壳  

完整协议与词库：[`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md)。

---

## 仓库结构

```text
ielts-peel-skill/
├── skill/                            # ★ 产品本体
│   ├── SKILL.md                      # Agent 入口
│   ├── README.md
│   └── references/
│       ├── SYSTEM_PROMPT.md          # 完整系统协议
│       ├── e2-entities.json          # E2 实体库
│       ├── models.json               # 三大降维模型
│       └── keywords.json             # 母题关键词
├── .grok/skills/ielts-peel-skill/   # 项目内 Skill 镜像
├── Agent_System_Prompt.md            # Prompt 源（sync 到 skill）
├── client/                           # 可选 playground UI
├── server/                           # 可选 API + 结构化知识
├── tests/                            # 质检 / 检索 / 解析单测
├── docs/EVOLUTION_BLUEPRINT.md       # 架构进化蓝图
├── scripts/
│   ├── build-prompt.mjs
│   └── sync-skill.mjs
└── README.md
```

---

## 可选：本地 Playground

> 给作者 / 开发者自测 API 与质检用。**不是用户主界面。**  
> 详见 [`client/README.md`](./client/README.md)。

```bash
cd ielts-peel-skill
/usr/local/bin/npm run install:all
/usr/local/bin/npm run dev
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 | http://localhost:3001 |

Playground 能力（进化后）：

- BYOK：自备 OpenAI 兼容 Key（DeepSeek / 硅基流动 / Ollama…）  
- 按需注入母题知识（不再每次灌满 8k tokens）  
- 输出质检门禁 + 自动重试  
- `/score` 程序化评分  

若本机 `npm` 异常，请用 `/usr/local/bin/npm`，或：

```bash
node node_modules/concurrently/dist/bin/concurrently.js -k -n server,client \
  "node --watch server/index.js" \
  "node client/node_modules/vite/bin/vite.js --config client/vite.config.js"
```

---

## 开发与同步

```bash
# 改 Agent_System_Prompt.md 后，同步到 skill + systemPrompt.js
npm run sync:skill
npm run build:prompt

# 单测
npm test
```

CI：`.github/workflows/eval.yml` 在 push / PR 时跑单元与集成测试。

架构细节见 [`docs/EVOLUTION_BLUEPRINT.md`](./docs/EVOLUTION_BLUEPRINT.md)。

---

## 安全

| 项 | 说明 |
|----|------|
| Skill | 无 API Key、无个人经历剧本 |
| Playground | Key 仅浏览器 `sessionStorage`，经本机转发，不落盘 |
| 仓库 | 请勿提交 `.env`、版权 PDF、私人对话 |
| 公开前 | 确认未包含训练材料 PDF / 对话记录 |

---

## License

MIT — 见 [`LICENSE`](./LICENSE)。
