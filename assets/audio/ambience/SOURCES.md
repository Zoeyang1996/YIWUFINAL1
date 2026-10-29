# 市井实录音源

2026-10-30 从 Freesound 的公开 MP3 试听文件制作本地循环；以下原始录音均标注 CC0 1.0。
许可：https://creativecommons.org/publicdomain/zero/1.0/

| 场景 | 原始录音 | 录音者 | 截取区间 |
| --- | --- | --- | --- |
| 早市 | [上海惠南镇市集街道](https://freesound.org/people/rasfrecci_w_donna/sounds/347020/) | rasfrecci_w_donna | 12–62 秒 |
| 午市 | [西安街市叫卖](https://freesound.org/people/mycompasstv/sounds/474566/) | mycompasstv | 8–58 秒 |
| 夜市 | [柳州傍晚路边食街](https://freesound.org/people/lastraindrop/sounds/755969/) | lastraindrop | 28–78 秒 |

处理：双声道 24 kHz，移除直流偏移，2 秒交叠衔接，响度归一并保留峰值余量，输出 48 秒 / 112 kbps MP3。
录音中的人群、脚步、叫卖和车流来自现场，未生成或合成语音。它们并非义乌实地录音。
仅环境声按时辰切换；NPC 不播放说话声音。音乐和操作音效独立保留。

重建工具：`scripts/prepare-field-recordings.py`。音频不依赖外站热链，发布时包含本地文件。
