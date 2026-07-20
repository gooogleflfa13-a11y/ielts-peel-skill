# IELTS PEEL Hacker

逻辑生成器 —— 雅思大作文 Body / 口语 Part 3 专用 AI 写作助理。

全栈：`React (Vite) + Tailwind CSS` 前端 · `Node.js (Express)` 后端。  
内嵌 `Agent_System_Prompt.md`，支持 `/wizard` · `/peel` · `/matrix` 三条指令。

## 功能

- 前端输入 **API Key**（OpenAI 兼容；可改 Base URL）
- 三种模式：`/peel` 单点爆破 · `/matrix` 降维秒杀 · `/wizard` 母剧本锻造
- 结果分区展示：PEEL 四句高亮 + 中文底层逻辑 / Matrix 全结构
- API Key 仅存在浏览器 `sessionStorage`，经本机后端转发，不落盘

## 目录结构

```
peel-hacker-app/
├── Agent_System_Prompt.md      # 可部署系统提示词
├── package.json                # 根脚本（concurrently）
├── .gitignore
├── README.md
├── server/
│   ├── package.json
│   ├── index.js                # Express API
│   └── systemPrompt.js         # 内嵌 System Prompt
└── client/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        └── components/
            ├── Header.jsx
            ├── ApiKeyPanel.jsx
            ├── CommandPanel.jsx
            ├── ResultPanel.jsx
            └── PeelBlock.jsx
```

## 快速开始

### 1. 安装依赖

```bash
cd peel-hacker-app
npm run install:all
```

### 2. 启动开发环境

```bash
npm run dev
```

- 前端：http://localhost:5173  
- 后端：http://localhost:3001  

### 3. 使用

1. 在顶部面板填入 API Key（OpenAI 或兼容服务）
2. 可选：修改 Base URL / Model（默认 `https://api.openai.com/v1` · `gpt-4o-mini`）
3. 选择指令 → 输入题目/现象 → **Generate**
4. 右侧查看结构化分析结果

## API

### `POST /api/generate`

```json
{
  "apiKey": "sk-...",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4o-mini",
  "command": "peel",
  "input": "Some people think online education can replace traditional classrooms. To what extent do you agree?",
  "history": []
}
```

| command | 说明 |
|---------|------|
| `peel` | 单点 PEEL 四句 + 中文底层逻辑 |
| `matrix` | 三大模型匹配 + 横向秒杀 3 题 |
| `wizard` | 先追问生活细节，再生成母剧本（支持多轮 `history`） |

### `GET /api/health`

健康检查。

## 生产构建

```bash
npm run build
# 将 client/dist 由任意静态服务器托管；
# 或由 server 在 production 下托管（见 server/index.js）
npm start
```

## 兼容的 LLM 提供商

任何 **OpenAI Chat Completions** 兼容接口：

| 提供商 | Base URL 示例 |
|--------|----------------|
| OpenAI | `https://api.openai.com/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 硅基流动 | `https://api.siliconflow.cn/v1` |
| 本地 Ollama | `http://localhost:11434/v1` |

## 安全说明

- API Key 不写进仓库、不写进服务端 `.env` 也可运行（由用户在前端每次会话输入）
- 生产环境建议改为服务端环境变量托管 Key，并加鉴权

## License

MIT
