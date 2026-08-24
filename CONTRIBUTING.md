# 如何改课程超市

本仓库使用 **分支 + Pull Request**。`main` 一合并就会发布到 GitHub Pages，所以不在 `main` 上直接改。

公开站点：<https://qiushuji2077.github.io/course-supermarket/>

## 谁在哪个地方改

| 要改什么 | 在哪里 |
|---|---|
| 课程名、一句话、做法、学段、状态 | 主库课程卡 `~/Desktop/课程资源/10 学科库/` |
| 货架、导购、手推车交互 | 本仓库 `index.html`、`assets/` |
| 内部工作底账 | 主库运行 `python3 "80 展示输出/生成课程超市内部表.py"` |

人和 AI 都走同一条路。不要给 AI 另开直推通道。

## 发布货架

1. 生成公开数据（在主库）：

   ```bash
   ruby "80 展示输出/课程超市/generate.rb"
   ```

2. 本地打开 `index.html` 看一眼。

3. 开分支、提交、创建 PR。模板见 `.github/pull_request_template.md`。

4. 合并 PR 后，GitHub Pages 会发布。不要在 PR 里点「直接推送到 main」。

一键脚本 `80 展示输出/更新课程超市.command` 会做到第 3 步：生成、建分支、推送、打开 PR。它不会合并。

## 回退

- 关掉尚未合并的 PR。
- 已上线的版本：用 GitHub Revert 开反向 PR。
- 不要 force-push `main`。

## 公开边界

页面上只出现课程编号、学段、学科、方向、课程名、副名、一句话和主要做法。学校名、来源类型、内部状态和星级留在主库。
