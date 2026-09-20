# 企业内部培训智能考核系统

> 基于 FastAPI + Taro 小程序 + React/Ant Design 网页端 + LangChain/LangGraph 的企业内训考核平台：上传培训资料 → AI 按资料出题 → 逐题即时判分 → AI 复盘报告 → 管理端成绩报表，一条链路走完。
>
> 在线演示：http://47.120.34.207:8080 （管理端与员工端同一入口，按账号角色自动路由）
>
> 小程序端为本地演示：Taro 编译后用微信开发者工具打开 `frontend/dist`，测试号未发布。

---

## ✨ 核心功能

| 模块 | 说明 |
|---|---|
| Agentic RAG 出题 | LangGraph `create_react_agent` 自主决定搜什么、搜几轮（Tavily）；指定培训资料时改为向量召回并强制以资料为准 |
| 培训资料知识库 | PDF / Word / Markdown 上传 → 异步解析切片（1000/150）→ DashScope `text-embedding-v4` 入 ChromaDB，实时显示分块数与状态 |
| 异步任务 + 轮询 | 出题约 7 秒，`POST /quiz/async` 秒级返回 `task_id`，前端轮询取结果，避免长连接被网关切断 |
| 逐题即时判分 | 单选/多选/判断三种题型，答完立刻给对错与讲解；判分在**服务端**完成，不信任前端提交的答案 |
| AI 复盘报告 | 掌握度、薄弱知识点、知识总结、后续建议、可分享金句，落库后可随时回看 |
| 账号与 RBAC | bcrypt（cost 12）加盐哈希 + JWT HS256（payload 带 `role`）+ FastAPI 依赖注入分层守卫；管理员可批量建员工号、重置密码、停用账号 |
| 考核任务模型 | 培训资料 → 考核任务（题量/难度/及格线/截止时间）→ 成绩记录，支持补考与多次成绩取最佳 |
| 成绩报表 | 按考核任务汇总参考人数、平均正确率、通过率，可下钻到每个人的答题明细 |
| 知识库按用户隔离 | 每人独立 collection（`kb_user_{user_id}`），检索带 `doc_owner_id` 过滤，A 的资料不会被 B 出题时召回 |
| 双端共用一套后端 | 网页端（账号密码）与小程序端（微信静默登录）共用 `users` 表，靠 `role` 与接口分层区分 |

---

## 🏗 架构

```
浏览器 (React 19 + Vite + Ant Design 6)          微信小程序 (Taro 4 + React 18)
        │                                                │
        ▼                                                │
Nginx（宝塔站点，:8080）                                  │
   ├── /        → 前端静态产物 web/dist/                  │
   └── /api/    → 反向代理 127.0.0.1:8010 ────────────────┘
                    │
                    └─ FastAPI (uvicorn, 容器内 :8000)
                         ├─ aiomysql 连接池 → MySQL 8（7 张表，启动时幂等迁移）
                         ├─ LangGraph ReAct Agent → DeepSeek（OpenAI 兼容协议）
                         │                         └→ Tavily 联网搜索（可关）
                         ├─ DashScope Embedding → ChromaDB（按用户分 collection）
                         └─ structlog 结构化日志
```

- 后端宿主机端口只绑 `127.0.0.1:8010`（`8000` 已被服务器上另一项目占用），公网只暴露 Nginx
- MySQL 容器不出内网，无宿主机端口映射
- 密钥全部走仓库根的 `.env`（已 gitignore），镜像构建时被 `.dockerignore` 排除

出题链路：

```
用户输入 / 指定培训资料
  ├─ 有资料 → ChromaDB 按 doc_owner_id 召回 top-k（top_k=4）
  ├─ 无资料 → ReAct Agent 自行决定搜什么、搜几轮（Tavily，超时 60s）
  └─ 拼装 Prompt → DeepSeek → 严格 JSON 解析与校验 → 落库 quiz_sessions
```

---

## 📦 目录结构

```
├── backend/
│   ├── app/
│   │   ├── main.py                FastAPI 入口 + 生命周期（启动即跑迁移）
│   │   ├── core/
│   │   │   ├── config.py          pydantic-settings 读 .env
│   │   │   ├── db.py              aiomysql 裸连接池 + 幂等迁移
│   │   │   ├── auth.py            JWT 签发/解析 + 三类鉴权依赖
│   │   │   ├── password.py        bcrypt 加盐哈希（cost 12）
│   │   │   └── security.py        内容安全关键词拦截
│   │   ├── llm/                   LangGraph Agent、出题/报告链、Embedding
│   │   ├── prompts/               出题与复盘 Prompt（严格 JSON 契约）
│   │   ├── services/              业务编排（出题、判分、报告、知识库、考核任务）
│   │   ├── repositories/          裸 SQL 数据访问层
│   │   └── api/v1/routes/         auth / admin / assessment / knowledge / quiz / report / user
│   ├── scripts/init_admin.py      管理员建号/重置口令（口令必须命令行传入，无默认值）
│   ├── tests/                     165 个用例
│   └── Dockerfile
├── web/                           网页端（管理端 4 页 + 员工端 3 页）
├── frontend/                      小程序端（Taro 4，编译 weapp / H5）
├── docs/                          需求分析 / 方案设计 / 部署手册 / 本地运行 / 项目总结
├── samples/                       演示用培训资料（虚构企业制度文档）
└── prototypes/                    早期 AI 生成的 HTML 原型
```

---

## 🚀 本地启动

```bash
# 1. 后端（需要本机 MySQL 8）
cd backend
cp .env.example .env              # 填 DeepSeek Key、MySQL 连接信息
pip install -r requirements.txt
python -m scripts.init_admin <管理员用户名> <密码>
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. 网页端
cd ../web && npm install && npm run dev

# 3. 小程序端（需微信开发者工具，导入目录选 frontend/dist）
cd ../frontend && npm install --legacy-peer-deps && npm run dev:weapp
```

完整环境差异说明（免安装版 MySQL 需手动拉起、Taro prebundle 兼容问题、`dev:h5` 与 `dev:weapp` 共用 `dist` 不能同时开等 5 处坑）见 [docs/本地运行环境记录.md](docs/本地运行环境记录.md) 与 [docs/保姆级本地运行指南.md](docs/保姆级本地运行指南.md)。

## 🧪 测试

```bash
cd backend && python -m pytest -q
# 165 passed
```

覆盖鉴权与 RBAC、出题与判分、知识库上传与召回、异步任务状态机、成绩聚合。

## 🖥 生产部署（已实操）

阿里云 ECS（Ubuntu 22.04）+ 宝塔面板：Docker Compose 起 `mysql + backend`，Nginx 在 8080 做静态托管与 `/api/` 反代，与服务器上既有项目端口错开。逐步命令、验收清单与故障排查表见 [docs/服务器部署操作手册.md](docs/服务器部署操作手册.md)——其中记录了实际踩到的坑：宝塔「域名」框三条校验、`location` 指令粘贴位置导致 Nginx 起不来、逐个文件上传 `dist` 造成白屏、`env_file` 的实际解析路径、以及**未备案 `.cn` 域名连 8080 都会被阿里云拦成 403**（所以对外访问用 IP:端口）。

---

## 🔧 几个值得说的设计取舍

**为什么用 bcrypt 而不是更快的哈希。** 实测单次哈希约 200ms。这个"慢"是特性：它把离线爆破的成本抬高约 4 个数量级，而登录是低频操作，200ms 用户无感。

**为什么不信任 JWT 里的 role。** `get_current_web_user` 每次回查数据库并校验 `status == 1`，所以管理员停用一个账号后，该账号手里尚未过期的 token 立刻失效。token 里的 `role` 只用于路由分流，不作为授权依据。

**为什么判分放在服务端。** 前端只提交 `question_id` 与所选答案，正确答案与讲解由服务端返回。判分逻辑放前端等于把答案打包发给用户。

**为什么出题要做异步任务 + 轮询。** 一次出题约 7 秒，长连接会被中间的 Nginx/网关按超时切断；改成秒级返回 `task_id` + 前端轮询后，超时问题消失，且任务状态可复现、可观测。

**结构化输出的容错。** Prompt 明确"只能输出合法 JSON"，解析层再校验一次：题量不足自动补齐、判断题选项强制「正确/错误」、多选答案少于 2 个判为无效。AI 报告落库失败不阻断答题主流程（异常只记日志）。

---

## ⚠️ 已知限制（诚实清单）

- 对外访问是 `http://IP:8080` 明文。域名路线被实测堵死：未备案的 `.cn` 域名在任意端口都会被阿里云拦成 403，与端口无关；要上域名必须先 ICP 个人备案（7~20 天，且按量付费实例需先转包年包月才拿得到备案服务码）。
- 小程序用测试号，只能本地开发者工具演示；「关于小程序」面板里的名字由平台分配，改不了。
- 成绩海报按钮只弹「开发中」提示，未实现 canvas 绘制。
- 员工列表时间格式带 `T`（`2026-09-20T18:17:52`），成绩报表是空格分隔，两处后端返回不一致，未修。
- 出题依赖大模型，偶发返回非法 JSON 或题量不足；已做校验与补齐，但没做多次重试。
- 知识库向量库是本地文件（`./data/chroma`），单实例可用，多实例无法水平扩展。

---

## 📚 来源声明

本项目基于编程导航课程《Python 全栈 | AI 闯关学习小程序项目教程》（作者：程序员鱼皮，开源原型：[liyupi/yu-ai-learn](https://github.com/liyupi/yu-ai-learn)，MIT License）学习起步，在其基础上独立完成了以下改造与工程落地：

- **产品重定位**：从个人学习工具改造成企业内训考核系统，两端术语、页面文案、Prompt 人设全部重写（原仓库导航栏、页面、后端注释、README 均为上游品牌）
- **新增整个网页端**：管理端 4 页 + 员工端 3 页（React 19 + Ant Design 6 + TypeScript），原仓库只有小程序
- **账号体系**：用户名/密码登录、bcrypt 哈希、JWT + 数据库回查的 RBAC、员工批量建号与停用（停用后旧 token 立即失效）
- **考核领域建模**：培训资料 → 考核任务 → 成绩记录，含及格线、截止时间、补考与最佳成绩；服务端判分
- **成绩报表**：按考核任务聚合与下钻，并修掉一个真实缺陷（分页上限 50 与前端传 100 冲突导致下拉框显示原始 ID）
- **知识库按用户隔离**、内容安全关键词拦截
- **生产上线**：Docker Compose + 宝塔 Nginx 反代 + 安全组策略，配套部署手册、验收清单与故障排查表
- **数据库迁移**：启动时幂等迁移（加列、建索引、列默认值变更与存量回填），实测连跑两次结果一致

上游 12 个提交（`d12efdf`…`d68cf0b`）完整保留在本仓库 `main` 分支历史中，`LICENSE` 未改动。
