# 如何改课程超市

本仓库使用 **分支 + Pull Request**。不要在 `main` 上直接改。

现网：<https://supermarket.qiustudio.cn>（EdgeOne Pages）。GitHub Pages 只当备份。

## 谁在哪个地方改

| 要改什么 | 在哪里 |
|---|---|
| 一句话、做法要点 | 内部工作底账，由白话改、质检判通过 |
| 货架、导购、手推车交互 | 本仓库 `index.html`、`assets/` |
| 上架数据 | 生成器读工作底账页，写出 `assets/courses.js` |

人和 AI 都走同一条路。不要给 AI 另开直推通道。归档页 2 条不上架。

## 发布货架

1. 质检整批通过后，用底账生成公开数据：

   ```bash
   ruby "80 展示输出/课程超市/generate.rb"
   ```

2. 本地打开 `index.html` 看一眼。

3. 开分支、提交、创建 PR。模板见 `.github/pull_request_template.md`。

4. 合并 PR 后核 https://supermarket.qiustudio.cn 。不要在 PR 里点「直接推送到 main」。

## 回退

- 关掉尚未合并的 PR。
- 已上线的版本：用 GitHub Revert 开反向 PR。
- 不要 force-push `main`。

## 公开边界

页面上只出现课程编号、学段、学科、主题、课程名、副名、一句话和做法要点。学校名、来源类型、内部状态和星级不进本仓库。底账没有副名就空着。
