# IELTS PEEL Hacker

> **产品是 Skill**  
> 逻辑生成器 —— 雅思大作文 **Task 2 Body** / 口语 **Part 3**。  
> 用锁定结构 `[P] → [E1] → [E2] → [L]` 执行因果论证，而不是堆砌连接词。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## 30 秒搞懂

| 你要做什么 | 打开什么 |
|------------|----------|
| **装到 Agent 里用（推荐）** | [`skill/SKILL.md`](./skill/SKILL.md) |
| **贴到任意 LLM 的 System** | [`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md) |
| **本地自测 / 调试（可选）** | `client/` + `server/` playground |

```
                    ┌─────────────────────────┐
                    │   IELTS PEEL Hacker      │
                    │   = Skill / System Prompt │
                    └───────────┬─────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
    /peel 单点爆破      /matrix 横向秒杀      /wizard 母剧本
           │                    │                    │
           └────────────────────┴────────────────────┘
                                │
                    可选：本地 BYOK 网页壳（非产品）
```

---

## 目录

- [核心理念](#核心理念)
- [安装 Skill（产品交付）](#安装-skill产品交付)
- [四大指令](#四大指令)
- [思维方式指南](#思维方式指南)
- [仓库结构](#仓库结构)
- [可选：本地 Playground](#可选本地-playground)
- [开发与同步](#开发与同步)
- [安全](#安全)
- [License](#license)

---

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
git clone https://github.com/gooogleflfa13-a11y/ielts-peel-hacker.git
cd ielts-peel-hacker

# 用户级（本机全局）
cp -R skill ~/.grok/skills/ielts-peel-hacker
# 或
cp -R skill ~/.agents/skills/ielts-peel-hacker

# 项目级
mkdir -p .grok/skills && cp -R skill .grok/skills/ielts-peel-hacker
```

调用示例：

```text
/ielts-peel-hacker
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
| `.grok/skills/ielts-peel-hacker/` | 仓库内 Grok Skill |
| `Agent_System_Prompt.md` | System Prompt 源文件（改完后 `npm run sync:skill`） |

---

## 四大指令

### `/peel` — 单点逻辑爆破

输入一道具体题目 → **4 句全英文 PEEL** + 1 行中文底层逻辑。

**示例输入**

> Some people think online education can replace classrooms. Agree?

**示例输出结构**

```text
[P]  抽象立场 / 定性
[E1] 单向因果机制（无具体例子）
[E2] 物理实体场景（人 / 地 / 物 / 动作）
[L]  扣回 P

---
底层逻辑：教育母题 · 社会与情感节点 · 缺失模型 · E2: university seminar rooms
```

### `/matrix` — 降维打穿器

输入一个社会现象 → 自动匹配三大模型之一：

| 模型 | 名称 | 适用 |
|------|------|------|
| **A** | 代际差异 Young vs Old | 购物、App、饮食、科技态度… |
| **B** | 物理在场 vs 虚拟 | 网课、网聊、网购、流媒体 vs 现场… |
| **C** | 过去 vs 现在 | 社区、安静场所、沟通方式变迁… |

输出：命中模型 + 底层骨架 + 基准 PEEL + **横向秒杀 3 道同类题** + 逻辑同构说明。

### `/wizard` — 基准剧本生成器

Agent 先反问 3–4 个关于你真实生活的细节，再提取 E2 实体，生成**完全属于你自己的母剧本 PEEL**。

目的：用 3–4 个基准故事覆盖尽可能多的题库答案；同时可承担一部分 **Part 2** 内容底座，作为口语素材的地基与引导。

1. Agent 先问 **3–4 个**生活细节（不先写 PEEL）  
2. 你回答后 → 用你的细节做 E2 → 生成 3–4 套**属于你的**母剧本  
3. 附题库路由表：你的细节 → 母题 → 可横向秒杀题型  

E2 最难的不是「想不出高大上的例子」，而是大脑空白。`/wizard` 把你的生活直接武器化。

### `/score` — PEEL 质检

粘贴自己的 PEEL（带标签或四行）→ 冷酷检查：

- 是否缺层 / 禁用连接词  
- P 是否混进举例或过长因果  
- E2 是否缺少物理实体  
- L 是否过长或引入新观点  

Playground 下 `/score` **可不填 API Key**（纯程序质检）。

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
ielts-peel-hacker/
├── skill/                            # ★ 产品本体
│   ├── SKILL.md                      # Agent 入口
│   ├── README.md
│   └── references/
│       ├── SYSTEM_PROMPT.md          # 完整系统协议
│       ├── e2-entities.json          # E2 实体库
│       ├── models.json               # 三大降维模型
│       └── keywords.json             # 母题关键词
├── .grok/skills/ielts-peel-hacker/   # 项目内 Skill 镜像
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
cd ielts-peel-hacker
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
