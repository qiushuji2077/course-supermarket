# 课程超市 · 给 AI 协作者

这个仓库是对外静态站。改货架内容：底账质检通过 → 生成 → 开 PR。不要直推 `main`。

## 源和本仓库

- 源是「课程超市内部工作底账」的工作底账页（白话写回的一句话、做法要点）。归档页不上架。
- 本仓库只发布匿名后的 `index.html`、`assets/`。
- `generate.rb` 读底账，留在主库，已被 gitignore，不会出现在 GitHub。
- 现网 https://supermarket.qiustudio.cn ；GitHub Pages 只当备份。

## 改内容的固定顺序

1. 确认底账工作底账页已质检通过。
2. 运行：`ruby "80 展示输出/课程超市/generate.rb"`（改接底账，不读旧课程卡）。
3. 生成本地预览，确认没有校名、状态、星级泄漏；副名未编造。
4. 从 `main` 拉出新分支，只提交公开文件。
5. 推送分支，打开 Pull Request，等合并后再上线。

```bash
git checkout main
git pull
git checkout -b catalog/YYYY-MM-DD-short-reason
git add index.html assets/ README.md CONTRIBUTING.md AGENTS.md
git status   # 确认没有 generate.rb、内部编号、底账 xlsx、学校名
git commit -m "Refresh public catalog to N courses from ledger"
git push -u origin HEAD
gh pr create --base main --title "刷新课程超市货架" --body "..."
```

## 绝对不要

- 不要 `git push origin main`。
- 不要 force-push `main`。
- 不要把学校名、主推／在库、特色度、实施度、验证、内部路径写进公开文件。
- 不要改已经发出去的课程编号。
- 不要改写一句话或做法要点；不要编副名。
- 不要把调研痛点和他校负面细节带进这个仓库。
- 不要上架归档页。

## 怎么回退

- 未合并：关掉 PR，或再推一个修正 commit。
- 已合并：用 GitHub 的 Revert，再开一个反向 PR；不要在 `main` 上 reset --hard 后强推。
- 只改错一门课：回底账改对应列，重新生成，再开新 PR。

## 给审查 PR 的人

公开 diff 里通常是 `assets/courses.js`。请确认：

- 课程数量与工作底账页一致（归档不上架）。
- 搜不到学校名、`主推`、`在库`、`特色度`、`实施度`。
- 旧课程编号没有被改掉。
- 一句话、做法要点与底账原句一致（仅校名匿名）。
