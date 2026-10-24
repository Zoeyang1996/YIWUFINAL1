# 早市扇铺交互

预览入口：`market.html?phase=morning&shop=fans`。也可在早市走近后点击扇铺，或从「本市店簿 → 清风扇铺」进入。

## 本次接入

- 早市使用 `assets/markets/morning2.glb`，直接驱动其中已摆放的 NPC 骨骼，不重复加载独立 NPC。
- `morning-metadata.json` 保留旧 GLB 的地面、水面、远景和遮挡标记，原导航与碰撞数据继续使用 `morning.json`。
- 摊位镜头沿用原来的缓动，扇铺使用独立近景距离；镜头到位后摊主招手、商品栏出现。
- 商品缩略图来自实际扇子 GLB 渲染。四级预览使用独立 Three.js 场景，支持鼠标、触摸旋转和缩放、方向键旋转、重置视角。
- 购买加入现有本地购物车，并播放模型快照飞入右下角购物车的动效。此流程不发起支付。
- 点击窗外、关闭按钮或 Esc 关闭商品预览，保持扇铺近景；再退出摊位才回到漫游。打开购物车时 Esc 优先关闭购物车。
- 商品弹窗打开时暂停底层市集重复绘制。窄屏详情独立滚动，价格和购买区保持可见。

## 后续复用

1. 在 `js/data/products.js` 增加商品：`id/name/price/blurb/description/details/model/thumbnail`。当前红扇的 ¥68 是演示价格，文案也是展示文案。
2. 将商品 ID 放入 `js/data/phases.js` 中对应摊位的 `products`。带 `model` 的商品自动使用这套商品卡与四级预览；已有 `href` 商品保持原流程。
3. 如模型朝向不合适，可配置 `preview.rotation`（弧度，ZYX 顺序）；只有需要清除首个模型节点导出旋转时才启用 `preview.resetMeshRotation`。
4. 新摊位还需在场景导航配置中绑定实际节点、位置、朝向和焦点，可选 `cameraDistance` 控制近景距离。扇铺目前在 `js/market/map.js` 中追加。
5. `js/market/fan-keeper.js` 使用当前 NPC 的 `R_Upperarm / R_Forearm / R_Hand / Head` 骨骼。其他角色需按实际骨骼名与朝向适配。

视觉记录：`fan-stall-browser.png`、`fan-product-browser.png`、`fan-mobile-browser.png`。
