# 项目工作约束

## 不变量

- `incoming/` 只放用户提供的原图；`content/` 只描述站点、栏目和图片元数据。
- `public/media/`、`src/data/{manifest,site,collections,images}.json` 是 ingest 生成物，不手工编辑。
- 每张线上图片都必须有稳定 `id`/`slug`、SHA-256 源 hash、原始尺寸、非空 alt、栏目和完整响应式变体。
- Sharp 输出自动归一 EXIF 方向，并且不把 EXIF/IPTC/GPS 元数据带入线上派生文件；原图永远不复制到 `dist/`。
- `dist/` 是唯一部署产物。不要把服务端运行时、secret、account id、token 或模板作者的固定域名写进模板。

## 生成物边界

执行 `npm run ingest` 扫描 `incoming/`，生成 `public/media/<slug>/` 和 `src/data/*.json`，并只清理这些目录中的陈旧派生文件。不要让脚本删除仓库其他路径。

## 发布前强制检查

必须依次通过 `npm run ingest`、`npm run validate`、`npm run check`、`npm test` 和 `npm run build`。若目标平台是 GitHub Pages，还要确认 `PUBLIC_BASE_PATH` 与项目仓库名一致；若目标平台是 Cloudflare Workers Static Assets，assets 输出目录必须为 `dist`。

## 授权边界

本模板只负责生成静态文件和提供部署适配配置。除非用户明确授权，不要 push、创建远程仓库、写入第三方账户、触发外部部署或提交任何 secret。GitHub Pages 和 Cloudflare Workers Static Assets 由用户选择目标并授权后部署。

## 模板外观约束

默认直接套模板：只填图片、文案、分类、已有主题与六个颜色变量。保持页面结构、导航位置、三列网格及断点、间距、字体尺寸、卡片、全屏灯箱不变。不增加大图首页、侧栏、搜索或收藏入口。泛化的重构或美化请求不授权重新设计。交付前运行 build-gallery 的 check_template.py；失败需恢复模板。仅用户明确指定的具体布局定制可例外，并记录到 GALLERY.md。
