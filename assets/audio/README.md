# 市巷慢游

为「义犹未尽 · 义乌三时市集」原创的程序合成乐曲，无外部录音或采样素材。

- `market-stroll.wav`：96 秒，80 BPM，D 宫五声音阶（D / E / F♯ / A / B），32 小节。
- 音色：拨弦、竹笛感主旋律、低音空五度与轻木质节拍；轻立体声空间尾音循环衔接。
- 24 kHz、16-bit、双声道 PCM。峰值约 0.67，预留操作音效混音余量。
- 复现：`python3 scripts/generate-market-music.py`（依赖 NumPy）。

`js/core/audio.js` 用 Web Audio 合成木质按键、入铺/离铺铃音、商品/购物车反馈和低声脚步；不需额外下载音效文件。脚步随实际移动距离触发，按键自动重复不叠加提示。音乐及音效音量独立保存；静音同时关闭两者。首次操作启动声音，后台/失焦暂停，切页保存乐曲位置，浏览器允许时自动续播。查看摊位、商品或购物车时背景乐降低至正常的 68%；夜市整体再轻一些。

验证：`node --experimental-default-type=module --test scripts/test-audio.mjs`。行为测试使用音频/DOM 测试替身，另检查真实 WAV 的时长、声道、峰值和循环接缝；浏览器试听用于最终主观音色调整。

## 三时环境声

- `ambience/morning.wav`：48 秒立体声循环；较疏的早起聊天、早点/热茶叫卖、杯碗声、蒸汽与少量鸟鸣。
- `ambience/noon.wav`：48 秒立体声循环；更密的买卖交谈、讨价还价、来往脚步、木轮与木器声。
- `ambience/night.wav`：48 秒立体声循环；轻风、间歇虫鸣、很淡的水声和少量木质声，不含人群叫卖。比白天更安静。

复现：`python3 scripts/generate-market-soundscape.py`，需要 NumPy、macOS `say` 及脚本列出的中文声线。环境由合成人群声与程序生成的器物/自然声混音，没有使用外部录音采样。

NPC 单独的招呼语音已移除，不再预载、播放或打包；对应字幕与人声音量控件也已移除。旧 `voices/` 文件仅保留为制作归档。摊主点头动作和原有文字介绍保留。音乐、操作音效、环境声分别调节并记忆。

检查：`node --experimental-default-type=module --test scripts/test-audio.mjs scripts/test-soundscape.mjs`。
