# 如何更新课程超市

本仓库使用分支和 Pull Request。正式站点是 <https://supermarket.qiustudio.cn>，由 EdgeOne Makers 从 `main` 自动部署；GitHub Pages 是备份。

## 文件位置

- `index.html`：页面与选课、融合、回执交互。
- `assets/design-catalog.js`：本版公开课程数据。
- `assets/design-responsive.css`：小屏幕适配。
- `assets/design-support.js`、`assets/vendor/`：页面运行脚本。
- `sw.js`、`manifest.webmanifest`：主屏幕和离线缓存。

更新课程前，先确定本次被授权使用的具体数据源。2026-09-24 的发布以用户指定压缩包为准；这不代表以后的附件都自动成为公开货架。检查课程数量、编号唯一性、来源匿名化和内部字段，再进行本地预览。

通过 PR 合并到 `main` 后，检查 EdgeOne 的生产部署是否使用新提交，并打开正式网址核对课程数量和关键交互。回退已上线版本时，用 GitHub Revert 另开 PR，不要强推 `main`。
