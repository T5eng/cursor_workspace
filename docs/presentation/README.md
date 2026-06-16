# 技术分享材料说明

1 小时技术分享：**从 LLM 到 Agent — AI Coding 与开源热点速览**

## 文件清单

| 文件 | 用途 |
|------|------|
| [`slides.md`](./slides.md) | PPT 逐页文案（20 页），含演讲节奏锚点 |
| [`slides-marp.md`](./slides-marp.md) | Marp 格式，可一键导出 PDF / PPTX |
| [`speech-script.md`](./speech-script.md) | 完整口播稿（约 7500 字，58–60 分钟） |

## 导出 PPT

### 方式一：Marp（推荐）

```bash
# 安装 Marp CLI
npm install -g @marp-team/marp-cli

# 导出 PPTX
marp slides-marp.md --pptx -o presentation.pptx

# 或导出 PDF
marp slides-marp.md --pdf -o presentation.pdf
```

也可在 VS Code 安装 [Marp for VS Code](https://marketplace.visualstudio.com/items?itemName=marp-team.marp-vscode) 插件，打开 `slides-marp.md` 后预览并导出。

### 方式二：手动制作

按 `slides.md` 每页标题和要点，复制到 Keynote / PowerPoint / Google Slides。

## 演讲前替换

- 封面 `[你的名字]` 改为实际分享人
- 根据听众背景，酌情删减 Slide 18–19（ASI 部分可压缩到 2 分钟）

## 时间分配

| 模块 | Slide | 时长 |
|------|-------|------|
| 开场 | 1–3 | 3 min |
| LLM | 4–6 | 12 min |
| Agent | 7–9 | 15 min |
| AI Coding + 热点 | 10–15 | 22 min |
| 总结 + ASI | 16–19 | 8 min |
| Q&A | 20 | 3 min |
