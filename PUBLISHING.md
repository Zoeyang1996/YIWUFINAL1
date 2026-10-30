# 公开站点

- 网址：https://yiwu-three-markets.awakegiant2.chatgpt.site
- 托管：Sites，公开访问
- 项目 ID：`appgprj_6ae12aa393408191bcb5bb39da8be4ee`
- 已发布版本：1
- 源码提交：`124f90370ba74389c18116ca0ca2786cec223070`
- 部署 ID：`appgdep_6ae12facb22c8191bd9e85759ff35db8`
- 平台确认部署成功：2026-10-28

## 更新发布

1. 在原项目编辑代码和资源，运行 `node scripts/build-public-site.mjs`。
2. 发布目录是 `sites/yiwu-three-markets`，站点身份保存在其中的 `.openai/hosting.json`。后续发布必须复用上述项目 ID，不要重新创建站点。
3. 按 Sites 工作流获取临时仓库凭证，通过隐藏 stdin 传入发布工具；不要将凭证写入文件或命令参数。
4. 推送发布目录的完整源码后，用 Sites 打包工具生成归档，保存新版本并部署到现有公开站点。

运行用 GLB 已于 2026-10-30 做减面、WebP 贴图和 Meshopt 压缩；原始版本可从 Git 提交 `6d20a64bd0efc0e5e781ff827fe22c2e7ce6c45b` 恢复。优化参数、统计和复现方式见 [PERFORMANCE.md](PERFORMANCE.md)。

发布脚本只复制运行时实际使用的资源，再将优化后的 GLB 无损 gzip 压缩为不超过 20 MiB 的分段，并生成 `js/data/asset-manifest.js`。浏览器按需下载、解压后交给配置了本地 Meshopt 解码器的 GLTFLoader。脚本逐一验证完整解压结果；清单支持域名根目录和仓库子路径。

首次发布约 144 MB 压缩模型。托管 Git 单次推送限制 64 MiB；`scripts/push-site-batches.mjs` 是首次发布的分批上传恢复工具，可从已上传的祖先提交继续。日常小改动按正常工作流推送即可。

本次本地生成的发布包包含 20 个模型，压缩模型合计约 64.4 MB（61.43 MiB）。本次优化尚未更新线上部署，页面顶部的版本和部署信息仍指上次发布。

已完成模型往返校验、三个市集资源/镜头/骨骼检查、长按 E 状态测试和平台部署确认。尚未完成实际浏览器全流程验收。
