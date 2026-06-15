# GitHub Pages 部署说明

## 自动部署

每次推送到 `main` 分支，GitHub Actions 会把站点发布到 **`gh-pages`** 分支。

## 首次启用（只需做一次）

1. 打开仓库：https://github.com/T5eng/cursor_workspace/settings/pages
2. **Build and deployment** → **Source** 选择 **Deploy from a branch**
3. **Branch** 选 **`gh-pages`**，文件夹选 **`/ (root)`**
4. 点击 **Save**

等待 1–2 分钟后访问：

**https://t5eng.github.io/cursor_workspace/**

### 做T量化分析（独立路径）

**https://t5eng.github.io/cursor_workspace/t-trading/**

## 手动重新部署

在 Actions 页选择 **Deploy to GitHub Pages** → **Run workflow**。
