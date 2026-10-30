# 模型与网页性能优化

2026-10-30。本次修改本地项目及发布目录，未部署线上版本。体积单位为 MiB（1024² 字节）；面数按 GLB 中 mesh primitive 的三角形统计，实例在画面中的重复绘制不包含在此计数内。

| 资源 | 原体积 | 优化后 | 原三角面 | 优化后三角面 |
| --- | ---: | ---: | ---: | ---: |
| 早市场景 | 94.53 | 22.86 | 986,575 | 697,357 |
| 午市场景 | 48.68 | 16.81 | 812,212 | 586,984 |
| 夜市场景 | 82.34 | 21.65 | 1,786,685 | 1,277,547 |
| 主角 | 1.93 | 0.90 | 18,115 | 13,585 |
| 首页早市 | 2.57 | 0.51 | 11,801 | 11,801 |
| 首页午市 | 1.38 | 0.31 | 8,648 | 8,648 |
| 首页夜市 | 1.50 | 0.35 | 10,202 | 10,202 |

三个大场景合计 **225.56 → 61.31 MiB（减少 72.8%）**，三角面合计减少约 28.5%。主角减面约 25%。首页模型合计 **5.44 → 1.17 MiB**。

发布脚本生成的全部 20 个模型合计约 **61.43 MiB gzip**；按同一批资源的原始 gzip 字节统计，优化前约 135.13 MiB，减少约 54.5%。这是所有页面和商品合计，浏览器仅按需加载当前场景及打开的商品。源码仓库的历史大文件仍在 Git 历史中，本次没有重写历史。

## 处理方式

- 场景较大网格以 50% 为目标减面，几何误差上限 0.1%，锁住拓扑边界；小于 500 三角面的细节保持。误差和边界约束会让实际减面量小于目标。
- 主角保留约 75% 三角面，误差上限 0.05%。坐标、节点层级、骨骼权重、动画采样保持原精度；没有合并摊位节点或重定向骨骼。
- 贴图采用 WebP 质量 88，长边最大 1024，小图不放大。场景贴图像素数分别减少约 30.3%、28.3%、36.0%；主角及首页贴图像素数减少 75%。WebP 本身不是 GPU 压缩纹理，这些像素数也不等于整个应用的显存占用。
- Meshopt 压缩几何和动画；保留位置与权重 float32，只量化法线、切线、UV 和颜色。约 29 KB 解码器及 MIT 许可证保存在 `vendor/meshoptimizer/`，运行时不依赖外部 CDN。
- 修复原导出的负 UV 索引，对缺失 UV 的表面显式保留 WebGL 默认 `(0,0)` 采样，删除无节点的备用光照场景；显式声明 `KHR_mesh_quantization`。
- 手机/低内存设备像素倍率最高 1.25，市集阴影 1024；桌面按像素预算限制超大画布。后台页面暂停绘制，市集资源就绪前不绘制空场景，首页静态网格启用视锥裁剪。
- 压缩资源清单按页面目录解析，支持 GitHub Pages 一类仓库子路径。

完整字节数、三角面、贴图像素、SHA-256 及每文件参数保存在 [assets/optimization-report.json](assets/optimization-report.json)。算法参数含义参见 [glTF Transform simplify](https://gltf-transform.dev/modules/functions/functions/simplify)，压缩与减面的区别参见 [Meshopt 文档](https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression)。

## 复现与恢复

推荐 Node 22.13 或更新版本。优化工具独立安装，不会加入网页运行时依赖：

```sh
npm ci --prefix scripts/asset-tools
node scripts/asset-tools/optimize.mjs --source /path/to/original-project --output /path/to/optimized-output
```

源目录需包含表格中的七个原始 GLB，目录结构保持不变。脚本拒绝原地覆盖及再次处理 Meshopt 成品；输出候选资源和报告，检查通过后再复制到项目同名路径。避免对已压缩贴图反复有损压缩。

本次原始资产保留在本机忽略提交的 `.preview-check/asset-originals/`，也可从提交 `6d20a64bd0efc0e5e781ff827fe22c2e7ce6c45b` 提取。不要把备份、Blender 工作文件和测试截图加入发布目录。

## 验证

```sh
node scripts/asset-tools/validate.mjs
node scripts/verify-market-assets.mjs
node --test scripts/test-model-loader.mjs scripts/test-stall-hold.mjs scripts/test-audio.mjs scripts/test-soundscape.mjs
node scripts/build-public-site.mjs
```

Node 20 运行导入项目 `.js` 的测试或发布脚本时需加 `--experimental-default-type=module`。验证覆盖解码后的 GLB 格式、三个市集九个摊位、13 件商品、横竖屏镜头视线、主角行走/待机、摊主动作、加载失败重试、子路径清单解析及 gzip 往返字节一致性。格式校验为零错误，仍有沿用原资产的运行时切线生成、非根节点蒙皮等非阻断警告。

浏览器验收（默认使用 macOS 已安装的 Chrome，可用 `--chrome` 指定其他路径）：

```sh
python3 -m http.server 4173 --bind 127.0.0.1
# 另一个终端中，测试最终发布目录及子路径加载。
node scripts/asset-tools/browser-check.mjs --url http://127.0.0.1:4173/sites/yiwu-three-markets/dist --output .preview-check/browser-release
```

本机 Chrome 已检查桌面 1280×800、手机尺寸 390×844/DPR 3 的首页与三个市集，以及九个摊位进出；压缩前后近景对照未发现明显破面。最终发布包在仓库子路径下的 8 组页面测试全部通过，每个市集还打开并关闭了一个商品三维预览，两种尺寸均无页面错误。验收中修复了背景音乐按钮遮挡商品弹窗关闭按钮的问题。

截图及运行数据保存于 `.preview-check/`，不提交。手机尺寸模拟仍使用本机 GPU，不能替代真实低端手机、Safari 和弱网测试，也不能保证所有设备达到固定帧率。夜市仍有约 128 万三角面，后续若需覆盖低端机，可继续制作分级细节模型和降低绘制调用数。
