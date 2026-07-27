# IELTS PEEL Hacker — 项目介绍

## 一句话

一个冷酷的雅思写作/口语逻辑引擎：锁定每个论点进入 `[P] → [E1] → [E2] → [L]` 因果链，用程序化质量门取代模糊评价。

## 是什么

IELTS PEEL Hacker 是一个 **AI Agent Skill**，核心功能是接收雅思大作文（Task 2）或口语 Part 3 的题目，输出严格 PEEL 结构的英文因果论证段落。它不是"范文生成器"，而是一个带硬校验的**逻辑工序**——每层有明确的定义、禁区、物理性要求，不合格的输出会被打回重写。

附带一个本地 Web playground（React + Vite + Express），方便调试和在无 Agent 环境下单独使用。

## 项目位置

```
/Users/xiezhijie/Desktop/ielts agent/peel-hacker-app
```

GitHub 仓库：`gooogleflfa13-a11y/ielts-peel-skill`

## 项目结构

```
peel-hacker-app/
├── skill/                    # ★ 核心：Skill 定义（产品本体）
│   ├── SKILL.md              #   技能定义：命令表、PEEL 层物理规则、输出格式
│   └── references/           #   技能运行所需的静态数据
│       ├── SYSTEM_PROMPT.md  #     完整 AI System Prompt
│       ├── keywords.json     #     主题关键词映射
│       ├── e2-entities.json  #     E2 物理实体库
│       ├── models.json       #     通用归约模型 A/B/C
│       └── question-bank/    #     口语题库
│
├── server/                   # 后端（Node.js + Express）
│   ├── index.js              #   入口：API 路由 /api/generate /api/score /api/health
│   ├── orchestrator.js       #   核心编排：sanitize → classify → dispatch → parse → validate
│   ├── skills/               #   5 个命令的实现模块
│   │   ├── peelSkill.js      #     /peel：生成 PEEL 段落
│   │   ├── matrixSkill.js    #     /matrix：归约模型匹配 + sibling kill
│   │   ├── wizardSkill.js    #     /wizard：交互式题库 + 脚本锻造
│   │   ├── scoreSkill.js     #     /score：程序化 + 可选 AI 评分
│   │   └── bankSkill.js      #     /bank：内置题库操作
│   ├── prompts/              #   Prompt 构建器
│   │   ├── baseSystem.js     #     基础角色锁 + PEEL 四句定义
│   │   ├── peelPrompt.js     #     注入主题知识 + E2 燃料 + 输出格式
│   │   ├── matrixPrompt.js   #     注入归约模型
│   │   └── wizardPrompt.js   #     注入 wizard 协议
│   ├── evaluation/           #   质量门
│   │   ├── validator.js      #     程序化 PEEL 校验（107 物理指标正则）
│   │   └── aiScorer.js       #     可选 LLM 语义评分
│   ├── parsing/
│   │   └── peelParser.js     #   LLM 输出正则提取 [P][E1][E2][L]
│   ├── knowledge/            #   知识层（9 个主题的话题节点、词库、实体）
│   │   ├── topicRetriever.js #     主题分类 + 知识检索
│   │   ├── questionBank.js   #     口语题库引擎
│   │   ├── topics/*.json     #     各主题知识文件
│   │   ├── keywords.json     #     关键词
│   │   ├── e2-entities.json  #     E2 实体库
│   │   └── models.json       #     归约模型
│   ├── memory/
│   │   └── userMemory.js     #   用户记忆（E2 燃料、弱点追踪）
│   ├── utils/                #   工具
│   │   ├── llmClient.js      #     OpenAI 客户端（含重试 + 流式）
│   │   ├── sanitize.js       #     Prompt 注入防御
│   │   ├── constants.js      #     常量
│   │   ├── metrics.js        #     使用统计
│   │   ├── rateLimit.js      #     速率限制
│   │   ├── logger.js         #     结构化日志
│   │   └── errors.js         #     统一错误响应
│   └── data/                 #   知识层镜像
│
├── client/                   # 前端（React + Vite + Tailwind）
│   ├── src/
│   │   ├── App.jsx           #   根组件：设置管理、命令路由、API 调用
│   │   └── components/       #   UI 组件
│   │       ├── Header.jsx           #   标题 + 命令 badge
│   │       ├── ApiKeyPanel.jsx      #   API Key + Model 配置
│   │       ├── CommandPanel.jsx     #   命令选择器 + 输入框
│   │       ├── ResultPanel.jsx      #   结果展示（结构化/编辑/原始）
│   │       ├── PeelBlock.jsx        #   彩色 PEEL 渲染
│   │       ├── PeelEditor.jsx       #   可编辑 PEEL
│   │       ├── EvaluationPanel.jsx  #   质量门面板
│   │       └── EntityHighlighter.jsx #   实体高亮
│   ├── dist/                 #   生产构建
│   └── index.html
│
├── tests/                    # 测试
│   ├── unit/                 #   单元测试（parser, validator, sanitize, questionBank, prompt, topic）
│   ├── integration/          #   集成测试（完整 pipeline）
│   └── golden/               #   标准测试用例
│
├── scripts/                  # 构建脚本
│   ├── build-prompt.mjs      #   从 Agent_System_Prompt.md 生成 server/systemPrompt.js
│   └── sync-skill.mjs        #   同步 skill/ 到 .grok/ 和 ~/.agents/
│
├── docs/
│   └── EVOLUTION_BLUEPRINT.md #   演进路线图
│
├── Agent_System_Prompt.md    #   ★ 权威 System Prompt（单一真源）
├── README.md                 #   双语项目文档
├── PROJECT.md                #   本文件
├── LICENSE                   #   开源协议
├── package.json              #   根 workspace（dev/build/test/sync 脚本）
├── banner.gif                #   动态 Banner
├── gen_banner.py             #   Banner 生成脚本
├── .env.example              #   环境变量模板
├── .gitignore
└── vitest.config.js
```

## 架构

```
User (Agent Chat / Web UI)
        │
        ▼
┌──────────────────────────────────────┐
│  Express Server (server/index.js)    │
│  路由层：CORS、速率限制、验证         │
│  POST /api/generate                  │
│  POST /api/generate/stream (SSE)     │
│  POST /api/score                     │
│  GET  /api/health                    │
│  GET  /api/metrics                   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Orchestrator (orchestrator.js)      │
│  核心管线：                           │
│  sanitize → classify → dispatch →    │
│  build prompt → call LLM →          │
│  parse → validate → [retry?] →     │
│  return                              │
└──┬───────┬───────┬───────┬───────┬───┘
   │       │       │       │       │
   ▼       ▼       ▼       ▼       ▼
peel    matrix  wizard  score   bank
Skill   Skill   Skill   Skill   Skill
   │       │       │       │       │
   ├───────┼───────┼───────┤       │
   │       │       │       │       └──→ questionBank.js（题库操作）
   │       │       │       │
   │       │       │       └──→ validator.js / aiScorer.js
   │       │       │
   │       │       └──→ userMemory.js（E2 燃料持久化）
   │       │
   │       └──→ topicRetriever.js（主题分类 + 归约模型匹配）
   │
   └──→ 各 Skill 内部管线：
        ① topicRetriever.classify()     → 9 母题分类
        ② topicRetriever.loadTopic()    → 注入话题知识（nodes, lexicon）
        ③ buildPrompt()                  → 组装 System Prompt
        ④ callLLM() / streamLLM()       → 调用 OpenAI 兼容 API
        ⑤ peelParser.parse()            → 提取 [P][E1][E2][L]
        ⑥ validator.validatePeels()     → 程序化质量门
        ⑦ [retry if failed]             → 最多重试 1 次
        ⑧ detectEntities()              → 提取物理实体标签
        ⑨ recordPeelResult()            → 更新用户记忆
```

## 核心概念

### PEEL 四层物理规则

| 层 | 名称 | 视角 | 任务 | 禁止 |
|----|------|------|------|------|
| **P** | Point | 卫星 | 抽象论点 | 举例、因果链 |
| **E1** | Explanation | 无人机 | 单向因果机制 | 具体实体 |
| **E2** | Example | 显微镜 | 物理实体打击 | 纯抽象 |
| **L** | Link | 回归 | 逻辑封口，回扣 P | 新主张 |

### 5 个命令

| 命令 | 功能 |
|------|------|
| `/peel` | 生成 PEEL 段落（4 行英文 + 1 行中文底层逻辑） |
| `/matrix` | 匹配归约模型 + 生成 3 个 "sibling kill" PEEL |
| `/wizard` | 交互式挖掘用户生活细节，锻造个人 PEEL 脚本 |
| `/score` | 冷质量校验（层边界、E2 物理性、禁用词） |
| `/bank` | 内置口语题库操作（抽题、搜索、关联、统计） |

### 9 个母题

Education, Technology, Environment, Crime, Government, Media, Urbanization, Society, Health

### 3 个通用归约模型

| A | Generational Divide | 代际分裂 |
| B | Digital vs Physical | 数字 vs 物理 |
| C | Past vs Present | 过去 vs 现在 |

## 关键设计决策

1. **Skill 是产品本体，Web UI 是可选的**：`skill/SKILL.md` 是最优先维护的产物，任何 Agent 加载后即可运行。Web 端只是本地 playground。

2. **Agent_System_Prompt.md 是单一真源**：所有 System Prompt 从此文件生成（`build-prompt.mjs`），同步到 `skill/references/`。

3. **程序化质量门 > AI 评分**：Validator 全局离线运行（107 条正则 + E2 实体库匹配），不消耗 LLM token。AI 评分是可选的补充。

4. **Prompt 注入防御**：用户输入被包裹在 `[TASK PAYLOAD]` 边界内，sanitize.js 在执行前剥离 jailbreak 模式。

5. **用户记忆**：每次 PEEL 生成后记录弱点分布（P/E1/E2/L 各层失败次数），支持个性化弱点反馈。

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js, Express, openai SDK |
| 前端 | React 18, Vite, Tailwind CSS |
| 测试 | Vitest |
| 构建 | ES modules (mjs) |
| LLM | 任何 OpenAI 兼容 API |

## 启动

```bash
# 安装依赖
npm install
cd server && npm install
cd ../client && npm install
cd ..

# 配置
cp .env.example .env  # 填入 OPENAI_API_KEY / OPENAI_BASE_URL / MODEL

# 开发模式
npm run dev           # 同时启动 server (3001) + client (5173)

# 仅后端
npm run server

# 测试
npm test
```

## 证书

MIT License — 见 [LICENSE](./LICENSE)
