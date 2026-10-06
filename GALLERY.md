# 世界景点 · 纸上旅行

40 originals generated with built-in image_gen by the root and three country subagents. Style references: two user attachments; separate original scenes. White minimal built-in gallery template; four country filters; downloads and sharing enabled. Full prompts and official landmark source URLs: public/landmarks.json. Original PNGs: incoming/. Responsive AVIF/WebP/JPEG derivatives: public/media/.

Source page: /about.html. v1.0.0. Umami uses the existing personal tracker via environment config.

Image output budget is 150 MB for 40 high-texture paintings across responsive AVIF/WebP/JPEG formats (119 MB generated); original PNGs remain outside deployed assets.

Validation: template parity passed; 40 independent 1024×1536 originals and four category manifests audited; typecheck 0 errors/warnings; 7 tests passed; 600 derivative assets validated; production build and Wrangler dry-run passed; real browser country filters each 10, decoded lightbox, next and ArrowRight, native Escape/focus restoration, 390px no overflow, JPEG download HTTP 200; console no errors/warnings.

Publisher-requested customization (user explicitly invoked hn-project-publisher): v1.0.1 adds visible about/source, original-download and GitHub links inside the existing footer, using existing footer link styles. All page positions, grid, breakpoints, image ratios, spacing and CSS remain unchanged. check_template.py reports only src/pages/index.astro due to these footer links; this is a publishing customization, not an exact template copy.

User-requested lightbox customization (v1.0.2): portrait details fit available screen height in one view. Fixed viewport dialog and explicit minmax(0,1fr) media row prevent intrinsic image size from expanding the grid. Picture fills the constrained area and image scales with object-fit:contain. Header/footer controls retain their own rows; page gallery unchanged. Expected template differences: index.astro publisher footer and global.css lightbox rules.

v1.0.3: adds all ten earlier originals in seaside/ and scenes/, two groups of five. Fifty unique PNGs total; six filters; existing forty preserved. Output budget grows to 200 MB for the expanded derivative library. Height-fit lightbox rules retained. Original-download release target updated to v1.0.3.
