# 从 LLM 到 Agent：AI Coding 与开源热点速览

> PPT 共 20 页 · 演讲时长 60 分钟 · 无 Demo

---

## Slide 1 · 封面

**从 LLM 到 Agent**
AI Coding 与开源热点速览

分享人：[你的名字]
日期：2026 年 6 月

---

## Slide 2 · 今天讲什么

**一条主线**
```
LLM（大脑）→ Agent（行动者）→ AI Coding（场景）→ 开源热点（趋势）
```

**三个收获**
- 概念地图：RAG、MCP、Agent 不再绕晕
- 工具选型：IDE / CLI / 编排 Agent 怎么组合
- 实践原则：Context 优先、小步验收、人机分工

---

## Slide 3 · 议程

| 模块 | 时长 |
|------|------|
| LLM 速览 | 12 min |
| Agent 架构 | 15 min |
| AI Coding + 热点 | 22 min |
| 总结 + ASI 展望 | 8 min |
| Q&A | 3 min |

---

## Slide 4 · LLM 是什么

**是**
- 概率性文本生成器
- 模式匹配 + 推理引擎

**不是**
- 数据库 · 确定性程序 · 实时知识库

**核心局限**
幻觉 · 上下文有限 · 成本高 · 知识有截止日期

---

## Slide 5 · 五个必懂概念

| 概念 | 一句话 |
|------|--------|
| **Context Window** | 模型的「工作记忆」上限 |
| **RAG** | 外挂知识，不改模型权重 |
| **Function Calling** | 模型调用外部工具 |
| **System Prompt** | 定义角色、规则与边界 |
| **MCP** | 工具接入的标准化协议 |

---

## Slide 6 · 模型怎么选

**闭源：** GPT · Claude · Gemini
→ 能力强，开箱即用

**开源：** Qwen · DeepSeek · Llama
→ 可私有化，成本可控

**选型口诀**
> 先定场景和预算，再选模型。
> Context 管理往往比换模型更重要。

---

## Slide 7 · 什么是 Agent

**Agent = LLM + Planning + Memory + Tools + Feedback**

| | Chatbot | Workflow | Agent |
|---|---------|----------|-------|
| 灵活性 | 低 | 中 | 高 |
| 可控性 | 高 | 高 | 中 |
| 适合 | 问答 | 固定流程 | 开放任务 |

---

## Slide 8 · Agent 四大组件

```
        ┌─────────┐   ┌────────┐   ┌──────────┐
        │ Planner │ → │Executor│ → │ Observer │
        └─────────┘   └────────┘   └──────────┘
             ↑            ↓            ↓
          Memory        Tools       Feedback
```

- **Planning** — 任务分解、ReAct 推理
- **Memory** — 短期上下文 + 长期向量库
- **Tools** — 代码、文件、API、搜索
- **Feedback** — 自检、重试、人工介入

---

## Slide 9 · 框架与 Multi-Agent

**单 Agent 够用就先上**
LangChain · LangGraph · OpenAI Assistants

**多 Agent 再考虑**
CrewAI · AutoGen — 角色分工明确时

**口诀**
> 能单 Agent 解决，就别上 Multi-Agent。

**新趋势：MCP**
工具标准化 → 一次开发，多处复用

---

## Slide 10 · AI Coding 演进

```
L1  补全时代     Copilot、Tab 补全
      ↓
L2  对话时代     Chat with Codebase
      ↓
L3  Agent 时代   Cursor、Claude Code、Codex CLI
      ↓
L4  编排自治     OpenClaw、Hermes
```

**核心转变**
人写代码 → 人定义任务 · AI 执行 · 人验收

---

## Slide 11 · 工具三层分工

| 层级 | 代表 | 场景 |
|------|------|------|
| **IDE 内嵌** | Cursor、Copilot、Windsurf | 日常编码，人机同屏 |
| **CLI Agent** | Claude Code、Codex、OpenCode | 终端批量改、重构、脚本 |
| **编排 Agent** | OpenClaw、Hermes | 服务器 7×24，IM 派活 |

**组合用法**
IDE 写细节 + CLI 做重构 + 编排 Agent 跑流水线

---

## Slide 12 · 热点：OpenClaw

**定位：** 开源编排层，不是代码编辑器

```
你（Telegram / Slack）
        ↓
    OpenClaw（编排）
        ↓ ACP 调度
Claude Code / Codex / OpenCode
        ↓
   PR · 测试 · 通知回传
```

- 模型无关 · Skills 生态（ClawHub）
- 浏览器 + 代码 + Shell 闭环
- 典型：Issue → PR、自动 Code Review

---

## Slide 13 · 热点：Hermes Agent

**定位：** Nous Research 开源，记忆 + 自学

**Learning Loop**
```
观察任务 → 蒸馏成 Skill → 下次复用 → 反馈迭代
```

| | OpenClaw | Hermes |
|---|----------|--------|
| 亮点 | 编排 Coding Harness | Learning Loop、持久记忆 |
| Skills | 社区市场 ClawHub | 任务后自动生成 SKILL.md |
| 适合 | 接 IM、接 Coding 工具 | 长期跑、越用越懂工作流 |

---

## Slide 14 · OpenClaw vs Hermes vs IDE

| 工具 | 你在哪用 | 核心能力 |
|------|----------|----------|
| Cursor / Copilot | IDE 里 | 人机同屏写代码 |
| Claude Code / Codex | 终端里 | 单次深度编码任务 |
| OpenClaw | 服务器 + IM | 编排多个 Coding Agent |
| Hermes | 服务器 + IM | 自治 + 记忆 + 自学 |

> Claude Code 和你一起写；Hermes 你睡了它还在学。

---

## Slide 15 · 三个实践原则

| 原则 | 做法 |
|------|------|
| **Context 优先** | Rules、AGENTS.md、精准 @ 引用 |
| **小步验收** | 大需求拆小 PR，每步可验证 |
| **人机分工** | AI 做 80%，人做架构与关键 Review |

**常见坑**
上下文过长 · Agent 死循环 · 编排 Agent 权限过大

---

## Slide 16 · 四句话总结

1. **LLM 是引擎，Agent 是架构，AI Coding 是场景**
2. **工具分三层：** IDE / CLI / 编排 Agent，按场景组合
3. **OpenClaw = 编排 + Harness；Hermes = 记忆 + 自学**
4. **当前最优解是人机协作，** 不是全托管

---

## Slide 17 · 趋势：从 Copilot 到 Autopilot

- 更长上下文、更强推理（o 系列、Claude 4）
- Agent 标准化（MCP、A2A 协议）
- 行业焦点从 Chatbot 转向 Agentic 系统
- 开发者角色：写代码 → 定义问题 + 验收结果

---

## Slide 18 · 更远的路：DeepMind 与 ASI

**2026 年 6 月，Google DeepMind 发布《From AGI to ASI》**

| 概念 | 定义 |
|------|------|
| **AGI** | 接近单人中位水平的通用智能 |
| **ASI** | 超越大规模协调人类专家团队的认知能力 |

**四条路径（可并行）**
1. 算力 / 数据 / 模型规模持续 Scaling
2. 超越 Transformer 的新算法范式
3. 递归自我改进（AI 加速自身研发）
4. 多 Agent 集体智能（蜂巢式涌现）

---

## Slide 19 · ASI 与今天的关系

**Demis Hassabis（Google I/O 2026）**
> 「我们正处于奇点的山麓。」

**对工程师意味着什么**
- 今天学的 Agent 编排，可能是 ASI 路径四的雏形
- 百万 Agent 互联的安全与治理，已是前沿课题
- AGI → ASI 不是一步跃迁，而是一系列持续变革

**DeepMind 同时在做**
定义 AGI → 研究安全 → 描绘 ASI 之后

---

## Slide 20 · 谢谢 & Q&A

**推荐关注**
- 论文：ReAct · SWE-agent · From AGI to ASI
- 开源：OpenClaw · Hermes · OpenHands
- 社区：AI Engineer Summit · Latent Space

**Q&A**

预设问题：
- AI 会取代程序员吗？
- 公司代码安全怎么保障？
- 小团队从哪里开始？

---

## 附录：演讲节奏锚点

| 时间 | 对应 Slide | 备注 |
|------|-----------|------|
| 0:00 | 1–3 | 开场，建立预期 |
| 3:00 | 4–6 | LLM 部分 |
| 15:00 | 7–9 | Agent 部分 |
| 30:00 | 10–14 | AI Coding + 热点 |
| 52:00 | 15–17 | 总结 |
| 56:00 | 18–19 | ASI 展望 |
| 59:00 | 20 | Q&A |
