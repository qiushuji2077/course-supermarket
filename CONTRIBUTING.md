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

## 资料补全版本

- 原始612条位于 `assets/design-catalog.js`，本次不改写。
- 新增摘要、已有条目教学扩展、24板块索引位于 `assets/forum-catalog.js`。新增编号按对应学科现有最大值顺延；不得复用已有编号或把相似主题强行视为同一课程。
- 公开数据仅允许匿名化源摘要、查证到的实践描述和明确标为“未经试教”的教学推演。原始来源学校、证据网址、私人源文件路径和内部审阅字段不进入公开仓库。
- 更新后运行 `node --test tests/*.test.cjs`，核对数据数量、唯一编号、完整字段、索引关联、查证与推演边界，再验收本次补全筛选、详情、购物车、回执和手机布局。
- 页面、CSS、资料扩展与SW缓存版本须一致更新。只有完整资源成功缓存后才接管新SW；失败时保留旧版离线资源。
- 仍通过PR合并发布；不得跳过实际部署版本及正式域名核对。
