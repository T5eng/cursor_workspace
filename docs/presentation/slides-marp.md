---
marp: true
theme: default
paginate: true
size: 16:9
style: |
  section { font-size: 28px; }
  h1 { color: #1a73e8; }
  table { font-size: 22px; }
  code { font-size: 20px; }
---

# 从 LLM 到 Agent
## AI Coding 与开源热点速览

分享人：[你的名字] · 2026 年 6 月

---

## 一条主线

```
LLM（大脑）→ Agent（行动者）→ AI Coding（场景）→ 开源热点（趋势）
```

**三个收获**
- 概念地图：RAG、MCP、Agent
- 工具选型：IDE / CLI / 编排 Agent
- 实践原则：Context · 小步验收 · 人机分工

---

## 议程（60 min）

| 模块 | 时长 |
|------|------|
| LLM 速览 | 12 min |
| Agent 架构 | 15 min |
| AI Coding + 热点 | 22 min |
| 总结 + ASI 展望 | 8 min |
| Q&A | 3 min |

---

## LLM 是什么

**是：** 概率性文本生成 · 模式匹配 + 推理

**不是：** 数据库 · 确定性程序 · 实时知识库

**局限：** 幻觉 · 上下文有限 · 成本高 · 知识有截止日期

---

## 五个必懂概念

| 概念 | 一句话 |
|------|--------|
| Context Window | 模型的「工作记忆」上限 |
| RAG | 外挂知识，不改模型 |
| Function Calling | 模型调用外部工具 |
| System Prompt | 定义角色与规则 |
| MCP | 工具接入的标准化协议 |

---

## 模型怎么选

- **闭源** GPT · Claude · Gemini → 能力强
- **开源** Qwen · DeepSeek · Llama → 可私有化

> 先定场景和预算，再选模型
> Context 管理 > 换模型

---

## 什么是 Agent

**Agent = LLM + Planning + Memory + Tools + Feedback**

| | Chatbot | Workflow | Agent |
|---|---------|----------|-------|
| 灵活性 | 低 | 中 | 高 |
| 可控性 | 高 | 高 | 中 |

---

## Agent 四大组件

```
Planner → Executor → Observer
   ↑         ↓          ↓
Memory    Tools    Feedback
```

- Planning — ReAct、任务分解
- Memory — 短期上下文 + 长期向量库
- Tools — 代码、文件、API、MCP
- Feedback — 自检、重试、人工介入

---

## 框架与 Multi-Agent

- **单 Agent：** LangChain · LangGraph · Assistants API
- **多 Agent：** CrewAI · AutoGen（角色分工明确时）

> 能单 Agent 解决，就别上 Multi-Agent

**趋势：** MCP 工具标准化

---

## AI Coding 演进

```
L1 补全      Copilot
L2 对话      Chat with Codebase
L3 Agent     Cursor · Claude Code · Codex
L4 编排自治   OpenClaw · Hermes
```

**转变：** 人写代码 → 人定义任务 · AI 执行 · 人验收

---

## 工具三层分工

| 层级 | 代表 | 场景 |
|------|------|------|
| IDE 内嵌 | Cursor · Copilot | 日常编码 |
| CLI Agent | Claude Code · Codex | 终端重构 |
| 编排 Agent | OpenClaw · Hermes | 7×24 IM 派活 |

**组合：** IDE 写细节 + CLI 重构 + 编排跑流水线

---

## 热点：OpenClaw

**开源编排层，不是编辑器**

```
Telegram/Slack → OpenClaw → ACP → Claude Code/Codex → PR
```

- 模型无关 · ClawHub Skills 生态
- 浏览器 + 代码 + Shell 闭环
- 场景：Issue→PR · 自动 Code Review

---

## 热点：Hermes Agent

**Nous Research 开源 · 记忆 + 自学**

Learning Loop：观察 → 蒸馏 Skill → 复用 → 迭代

| | OpenClaw | Hermes |
|---|----------|--------|
| 亮点 | 编排 Harness | Learning Loop |
| Skills | ClawHub 社区 | 自动生成 SKILL.md |
| 适合 | 自动化流水线 | 长期个人助手 |

---

## 工具对比一览

| 工具 | 位置 | 能力 |
|------|------|------|
| Cursor/Copilot | IDE | 人机同屏 |
| Claude Code/Codex | 终端 | 深度编码 |
| OpenClaw | 服务器+IM | 编排多 Agent |
| Hermes | 服务器+IM | 记忆+自学 |

> Claude Code 和你一起写；Hermes 你睡了它还在学

---

## 三个实践原则

1. **Context 优先** — Rules、精准 @ 引用
2. **小步验收** — 拆小 PR，每步可验证
3. **人机分工** — AI 80%，人 20% 关键决策

**避坑：** 上下文过长 · 死循环 · 权限过大

---

## 四句话总结

1. LLM 是引擎，Agent 是架构，AI Coding 是场景
2. 工具分三层，按场景组合
3. OpenClaw = 编排；Hermes = 记忆 + 自学
4. 当前最优解是人机协作

---

## 趋势

- 更长上下文、更强推理
- Agent 标准化（MCP、A2A）
- 焦点从 Chatbot → Agentic 系统
- 开发者：写代码 → 定义问题 + 验收

---

## DeepMind：《From AGI to ASI》

**2026.6.10 · Google DeepMind · arXiv**

| 概念 | 定义 |
|------|------|
| AGI | ≈ 单人中位水平的通用智能 |
| ASI | 超越大规模协调人类专家团队 |

---

## 四条路径（可并行）

1. **Scaling** — 算力 / 数据 / 模型规模
2. **范式跃迁** — 超越 Transformer
3. **递归自我改进** — AI 加速自身研发
4. **多 Agent 集体智能** — 蜂巢式涌现

Demis Hassabis：**「我们正处于奇点的山麓。」**

---

## ASI 与今天的关系

- 今天的 Agent 编排 = 路径四的早期实践
- 百万 Agent 互联的安全已是前沿课题
- AGI → ASI 是一系列持续变革，非一步跃迁

**DeepMind 路线：** 定义 AGI → 研究安全 → 描绘 ASI 之后

---

## 谢谢 & Q&A

**推荐关注**
- 论文：ReAct · SWE-agent · From AGI to ASI
- 开源：OpenClaw · Hermes · OpenHands

**常见问题**
- AI 会取代程序员吗？
- 代码安全怎么保障？
- 小团队从哪里开始？
