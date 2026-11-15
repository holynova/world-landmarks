# 世界景点 · 纸上旅行

40 originals generated with built-in image_gen by the root and three country subagents. Style references: two user attachments; separate original scenes. White minimal built-in gallery template; four country filters; downloads and sharing enabled. Full prompts and official landmark source URLs: public/landmarks.json. Original PNGs: incoming/. Responsive AVIF/WebP/JPEG derivatives: public/media/.

Source page: /about.html. v1.0.0. Umami uses the existing personal tracker via environment config.

Image output budget is 150 MB for 40 high-texture paintings across responsive AVIF/WebP/JPEG formats (119 MB generated); original PNGs remain outside deployed assets.

Validation: template parity passed; 40 independent 1024×1536 originals and four category manifests audited; typecheck 0 errors/warnings; 7 tests passed; 600 derivative assets validated; production build and Wrangler dry-run passed; real browser country filters each 10, decoded lightbox, next and ArrowRight, native Escape/focus restoration, 390px no overflow, JPEG download HTTP 200; console no errors/warnings.

Publisher-requested customization (user explicitly invoked hn-project-publisher): v1.0.1 adds visible about/source, original-download and GitHub links inside the existing footer, using existing footer link styles. All page positions, grid, breakpoints, image ratios, spacing and CSS remain unchanged. check_template.py reports only src/pages/index.astro due to these footer links; this is a publishing customization, not an exact template copy.

User-requested lightbox customization (v1.0.2): portrait details fit available screen height in one view. Fixed viewport dialog and explicit minmax(0,1fr) media row prevent intrinsic image size from expanding the grid. Picture fills the constrained area and image scales with object-fit:contain. Header/footer controls retain their own rows; page gallery unchanged. Expected template differences: index.astro publisher footer and global.css lightbox rules.

v1.0.3: adds all ten earlier originals in seaside/ and scenes/, two groups of five. Fifty unique PNGs total; six filters; existing forty preserved. Output budget grows to 200 MB for the expanded derivative library. Height-fit lightbox rules retained. Original-download release target updated to v1.0.3.

v1.0.4: ten Korean landmark PNGs using hn-paper-gouache required reference images; total sixty; seven collections. Full source URLs and prompts preserved. Existing height-fit lightbox retained.

审计#37（2026-11-14）：60 条标题中间点改括号式（「圣家堂（巴塞罗那）」）；分类名去掉手写计数（改由页面按清单自动计数，避免漂移）；描述去掉版本号；页脚链接分隔改顿号；计数文案改为「已显示 X / 共 Y 张」；分享反馈区分「已分享/链接已复制/无法分享」；关于页去掉内部术语（subagent/incoming 目录）与版本号，来源列表中间点去掉；颜色改暖灰+黛蓝，editorial 主题陶土强调色改黛绿；字号收敛为 0.8rem/1rem/标题 clamp 三种。

筛选区单行横向滚动（2026-11-15，用户明确要求，模板外观约束的具体授权例外，与 #36 同款改法）：审计加计数后按钮变宽，手机上筛选区 4 行、挤占首屏图。改法：筛选区改单行横向滚动（不换行，触屏滑动/键盘 Tab 均可达，右侧 32px 渐隐提示可滑、滑到尽头渐隐消失；鼠标设备显示细滚动条）；张数保留，改小一号（0.8rem）次要灰、去括号，不撑宽按钮；按钮左右内边距 15px→12px，触控高度 44px 不变。计数行、标题、简介、网格、灯箱、颜色、字号档位一律不动。
