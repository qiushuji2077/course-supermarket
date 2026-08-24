# 课程超市 · 给 AI 协作者

这个仓库是对外静态站，不是课程主库。改货架内容，先改课程卡，再生成，再开 PR。不要直推 `main`。

## 主库和本仓库

- 课程正文、状态、星级、学校名在 `~/Desktop/课程资源`。
- 本仓库只发布匿名后的 `index.html`、`assets/`。
- `generate.rb` 和 `课程超市-内部编号.yml` 在主库里，已被 gitignore，不会出现在 GitHub。

## 改内容的固定顺序

1. 在主库改课程卡，或确认卡片已经是对的。
2. 在主库根目录运行：`ruby "80 展示输出/课程超市/generate.rb"`。
3. 生成本地预览，确认没有校名、状态、星级泄漏。
4. 从 `main` 拉出新分支，只提交公开文件。
5. 推送分支，打开 Pull Request，等合并后再上线。

```bash
cd "80 展示输出/课程超市"
git checkout main
git pull
git checkout -b catalog/YYYY-MM-DD-short-reason
git add index.html assets/
git status   # 确认没有 generate.rb、内部编号、学校名
git commit -m "Refresh public catalog to N courses"
git push -u origin HEAD
gh pr create --base main --title "刷新课程超市货架" --body "..."
```

也可以双击主库里的 `80 展示输出/更新课程超市.command`：它会生成数据、建分支、开 PR，不会直接推 `main`。

## 绝对不要

- 不要 `git push origin main`。
- 不要 force-push `main`。
- 不要把学校名、主推／在库、特色度、实施度、验证、内部路径写进公开文件。
- 不要改已经发出去的课程编号。编号表在主库，生成器会沿用旧号。
- 不要在网页上改写课程名、一句话或做法；原文来自课程卡。
- 不要把调研痛点和他校负面细节带进这个仓库。

## 怎么回退

- 未合并：关掉 PR，或再推一个修正 commit。
- 已合并：用 GitHub 的 Revert，再开一个反向 PR；不要在 `main` 上 reset --hard 后强推。
- 只改错一门课：回主库改卡片，重新生成，再开新 PR。

## 给审查 PR 的人

公开 diff 里通常只有 `assets/courses.js`。请确认：

- 课程数量与主库「主推＋在库」一致。
- 搜不到学校名、`主推`、`在库`、`特色度`、`实施度`。
- 旧课程编号没有被改掉。
