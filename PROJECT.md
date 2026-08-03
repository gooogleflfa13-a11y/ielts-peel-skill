# IELTS PEEL Hacker — 项目说明

> 当前仓库版本：`2.0.0`。本文描述当前实现；历史蓝图和旧审计不代表现行产品承诺，状态见 [`docs/ARCHIVE_STATUS.md`](./docs/ARCHIVE_STATUS.md)。

## 1. 产品定位

IELTS PEEL Hacker 是一个面向 IELTS Writing Task 2 与 Speaking Part 3 的论证训练工具，用 `[P] -> [E1] -> [E2] -> [L]` 约束观点、因果机制、具体证据和逻辑回扣。

它不是官方 IELTS 产品，不提供官方评分或 Band 预测，也未获得 British Council、IDP Education 或 Cambridge University Press & Assessment 的批准或背书。

## 2. 三种交付形态

| 形态 | 路径 | 能力边界 |
|---|---|---|
| Agent Skill | `skill/` | 由兼容 Agent host 解释 `SKILL.md` 与 references；不会自动执行 JavaScript validator |
| Raw system protocol | `skill/references/SYSTEM_PROMPT.md` | 可复制到模型 system message；引用 JSON 不会自动加载 |
| Local playground | `client/` + `server/` | 可执行 API/UI、解析校验、安全边界、学习状态和自动测试 |

`skill/` 是唯一 canonical skill 目录。`.grok/skills/ielts-peel-skill/` 只是显式生成的开发镜像，不是第二套真源。

## 3. 当前命令

| 命令 | 目的 | 关键限制 |
|---|---|---|
| `/peel` | 生成一个四句 PEEL 论证单元 | 生成内容需人工核验事实 |
| `/matrix` | 将一个机制迁移到同类题 | 是启发式训练，不是题目预测 |
| `/wizard` | 用用户生活细节构建个人素材 | 用户数据按不可信输入处理 |
| `/score` | 检查 PEEL 结构 | 不等于 IELTS 评分 |
| `/learn` | practice/hint/model/compare/revise 学习循环 | 反馈未经教师盲评校准 |
| `/bank` | 本地题库工具 | 默认禁用；来源权利未清前不属于公开授权产品 |

## 4. 运行架构

```text
Browser
  -> server/app.js                 HTTP/CORS/rate limit/error boundary
  -> server/schemas/request.js     request contract
  -> server/utils/sanitize.js      input handling
  -> server/pipeline/executeCommand.js
  -> server/commands/registry.js   command source of truth
  -> server/{skills,learner}/      command implementation
  -> server/evaluation/            parse/validate/feedback/quality gate
  -> server/schemas/response.js    response contract
```

主要真源：

- `server/commands/registry.js`：运行时命令注册表。
- `Agent_System_Prompt.md`：生成式 system prompt 的源文件。
- `skill/`：公开 Skill 包的 canonical 目录。
- `scripts/check-drift.mjs`：命令面与生成 prompt 的漂移检查。

## 5. 安装与开发

要求 Node.js 20 或 22、npm 10+。

```bash
# 三套 package 使用 lockfile 做可复现安装
npm run bootstrap

# 启动本地 UI + API
npm run dev

# 测试与漂移检查
npm test
node scripts/check-drift.mjs

# 生成 prompt artifact 并构建前端
npm run build
```

进程直接读取 shell environment；项目不会自动读取根目录 `.env`。例如：

```bash
APP_MODE=local \
PROVIDER_BASE_URL=https://api.openai.com/v1 \
CORS_ORIGINS=http://localhost:5173 \
npm run dev
```

API Key 由本地浏览器 BYOK 表单提交给本地 server，不从 `.env` 读取。浏览器会在当前 tab 的 `sessionStorage` 中保存 key；不要在不可信或共享设备上使用。

普通 `bootstrap`、`build`、`sync:skill` 不写用户 HOME。只有下面两个命令会显式安装用户级 Skill：

```bash
npm run install:skill:agents
npm run install:skill:grok
```

## 6. 安全与隐私边界

- Public mode 必须设置明确 CORS allowlist，并禁用本地 memory 与 question bank。
- 请求体不能指定 provider URL；API Key 只会被发送到 server 配置的 provider。
- 结构化 logger 会移除 `apiKey` 字段。
- 生成结果需要通过 parser/validator；一次修复后仍失败则返回 `QUALITY_FAILED`。
- SSE 在质量校验完成前不向客户端暴露生成文本。
- 本地学习数据可通过 `GET /api/learner/export` 导出，通过 `DELETE /api/learner/data` 删除；删除成功返回 HTTP 200 与 `{ userId, removed: true }`。
- `x-learner-id` 不是认证机制。启用本地存储的实例不能直接当作多租户公共服务部署。

安全报告流程见 [`SECURITY.md`](./SECURITY.md)。

## 7. 评测边界

当前自动检查覆盖标签顺序、句子边界、E2 具体性、L 回扣与禁用 discourse glue。criterion-oriented feedback 只是形成性教学映射，尚未通过合格 IELTS 教师的盲评校准。

系统不能可靠完成以下工作：

- 预测 Writing 或 Speaking Band；
- 从纯文本判断真实发音；
- 自动验证生成例子的事实真实性；
- 替代完整作文、完整口语表现或官方 examiner 评估。

## 8. 测试与 CI

当前测试集合为 32 个 unit test 文件和 6 个 integration test 文件，共 38 个 test files / 335 tests；`tests/golden/` 另含回归 fixture 数据。

GitHub Actions 在 Node 20 与 22 上执行：

1. 三套 `npm ci`；
2. 版本一致性检查；
3. drift check；
4. 335 tests；
5. client build；
6. tracked generated-file clean check；
7. 独立 dependency audit job。

CI 结果而非静态文档是每个 commit 的权威状态。

## 9. 许可与公开发行

- 源代码：MIT，见 [`LICENSE`](./LICENSE)。
- 原创文档/示例和第三方内容边界：见 [`CONTENT_LICENSE.md`](./CONTENT_LICENSE.md)。
- 商标、非隶属声明和题库隔离：见 [`NOTICE.md`](./NOTICE.md)。

标记为来自 local PDF warehouse 的题库文件仍在权利核验阶段，不得进入公开 release artifact，也不得由本项目许可证推定为可再分发或可商用。公开发布前还需要完成来源、权利人、授权范围、取得日期、审校和更正记录。

## 10. 贡献与发布

贡献者请阅读：

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- [`SECURITY.md`](./SECURITY.md)
- [`CHANGELOG.md`](./CHANGELOG.md)

正式发布需要 green CI、clean worktree、版权清理、统一版本、`v2.0.0` tag 和明确排除未授权内容的 release artifact。
