# 超级录屏 · 录音功能计划

[超级录屏](./superRecorder.md) 目前只录画面（`videoEditor.ts` 中 `getUserMedia` 的 `audio: false`），本文档记录为它添加录音（麦克风 + 系统内录）的调研结论、设计方案、实施顺序和后续优化点。

> **状态**：实施顺序 1~9 已全部完成并分批提交；「已知限制 & 后续优化」「测试要点」中的条目为后续跟进项（勾选框未勾即待办）。回归验证见 `test/superRecorderAudioE2E.mjs`。

## 目标

1. 录制：可选麦克风（可多选）、可选系统内录，录制面板可控、可看音量电平。
2. 播放：预览播放器（canvas + WebCodecs 手写播放器）播放时同步出声，播放/暂停/跳转跟随。
3. 导出：mp4、webm 导出时带上音频；gif/apng/png 天然无音频。
4. 编辑：音频跟随已有时间轴编辑（删除、变速），保证音画不错位。

## 调研结论

- 超级录屏全在 `src/renderer/videoEditor/videoEditor.ts`（单文件）：
  - 采集：`getUserMedia({ audio: false, video: {chromeMediaSource:"desktop"} })` → `MediaStreamTrackProcessor` → `VideoEncoder` → 内存中的 `EncodedVideoChunk[]`（录制期不落盘）。
  - 编辑：`uiData{clipList,speed,eventList,remove}` → `getFrameXs()` 得到逐帧 `FrameX` → `runTransform()` 只重编码变化帧。
  - 播放：无 `<video>`，canvas + `play()/pause()/jump2id()` 手写播放器，时间轴 `timeLineTrack` 工厂。
  - 导出：`mediabunny`（`Output` + `EncodedVideoPacketSource` + `BufferTarget`），不走 ffmpeg。
- 录屏（旧） `src/renderer/recorder/recorder.ts` 已有可借鉴的音频实现：
  - 麦克风：`enumerateDevices()` 过滤 `audioinput`，`getUserMedia({audio:{deviceId}})`，选择结果持久化到 `录屏.音频.设备列表`（`"00"` 表示系统音频）。
  - 系统内录：`getUserMedia({ audio: {mandatory:{chromeMediaSource:"desktop"}}, video: {...} })` 与视频同一调用（受 `录屏.音频.启用系统内录` 门控，注释说明可能导致应用崩溃）。
- mediabunny 1.14.3 已具备所需能力：`Output.addAudioTrack`、`AudioBufferSource`（PCM 直接进封装器，内部用 WebCodecs 编码）、`EncodedAudioPacketSource`、`getFirstEncodableAudioCodec`、`format.getSupportedCodecs()`。
- 全仓库此前没有任何 `AudioContext` / `AudioEncoder` 使用，音频链路需全新实现。
- 设置项：复用 `录屏.音频.设备列表`、`录屏.音频.启用系统内录`（录屏（旧）已在用，语义通用），**不需要新增设置项**。

## 设计

### 数据流

```
麦克风 track ─┐                                    ┌─ opus EncodedAudioChunk[]（录制结果，≈1MB/min）
系统内录 track ─┼→ AudioContext(混音/增益) → MediaStreamTrackProcessor
              │        └ 每路 GainNode：勾选=1，取消=0（取消后只写入静音，不保留原始声音）
              └→ AudioEncoder(opus) ───────────────┘
                                   ↓ 停止录制后（按需解码，用完即弃）
                        AudioDecoder → 源时间轴 PCM (AudioBuffer)
                                   ↓ buildTransAudio(frameXs)
                  OfflineAudioContext 调度（删除区间不排、变速段 time-stretch）
                                   ↓
                变换后 PCM (AudioBuffer) ─┬→ 预览播放 AudioBufferSourceNode
                                          └→ 导出 mediabunny AudioBufferSource
```

### 关键决策

1. **编码存 opus，不存 PCM**：录音 48k 立体声 float PCM ≈ 23MB/min，opus 128kbps ≈ 1MB/min。录制期只留编码 chunk；PCM 只在「变换/播放/导出」时按需解码，且源 PCM 在生成变换结果后即释放，稳态内存 ≈ 1MB/min(源) + 23MB/min(变换结果)。
2. **时钟对齐**：视频帧时间戳与音频 `AudioData` 时间戳（尤其经 AudioContext 处理后）可能不在同一纪元。统一用 `performance.now()` 作参考：
   - 录制中持续累计 `vOff = min(videoTs - perfNow*1000)`、`aOff = min(audioTs - perfNow*1000)`（µs）；
   - 停止时求出换算常量 `originUs = aOff + firstVideoTs - vOff`（`firstVideoTs` 为首个视频帧原始时间戳）；
   - 每个音频 chunk 的最终时间 = `(ts - originUs) / 1000`（ms，相对视频第 0 帧，负值丢弃）。
   - 误差 = 两路各自的最小采集延迟之差，经验值约 10~30ms，已标记为后续优化点。
3. **混音走 AudioContext**：每路 `createMediaStreamSource → GainNode → destination`，勾选/取消用增益开关（不中断混音输出，时间轴连续）；音量电平取混音 PCM 的 RMS。单路也走同一路径，保证只有一条代码路径。
   - 系统内录的 track 若未在录制开始时取得（默认不请求，保持现有行为不变），中途勾选时补一次 `getUserMedia({audio, video})`；其视频轨保留到录制结束（中途停止可能连带停掉同一会话的音频），失败则回退并提示。
4. **opus 参数自适应**：编码 `sampleRate/numberOfChannels` 取第一帧 AudioData；若采样率不在 opus 支持集（8/12/16/24/48k，如 44100）则转 48000，声道 >2 则降混为 2。转换统一输出 `f32-planar`。
5. **编辑跟随 `getFrameXs` 的时间线**：变换段由 `frameXs` 推导 —— 段起点 = `frameXs[i].timestamp`（输出时间轴），源区间 = `[srcCs.getTime(i), srcCs.getTime(i+1))`，输出时长 = `frameXs[i+1].timestamp - frameXs[i].timestamp`；被删除帧不产出段。
   - 变速：`timeStretch`（WSOLA）把段落源音频拉伸到输出时长且**保持音高**，再与删除区间一起排进 `OfflineAudioContext`，`startRendering()` 一次渲染完成。
6. **导出**：`saveWebm/saveMp4` 中 `format.getSupportedCodecs()` ∩ 候选列表（mp4: aac→mp3→opus；webm: opus→vorbis）→ `getFirstEncodableAudioCodec` → `output.addAudioTrack(new AudioBufferSource({codec, bitrate}))`，在视频包之后 `await audioSource.add(transPcm)`。取不到可编码音频 codec 时退化为无音频并在界面提示。
7. **播放**：播放/暂停/结束时用 `AudioBufferSourceNode` 启停，offset 取 `transformCs.getTime(playI)`，与现有 `resetPlayTime()` 的媒体时间一致；时钟同源（单调钟），不额外做漂移校正。

### 文件改动清单

| 文件 | 内容 |
| --- | --- |
| `src/renderer/videoEditor/audio.ts`（新增） | 采集 `AudioCapture`（混音/增益/编码/电平/时钟偏移）、解码 `decodeSrcAudio`、变换 `buildTransAudio` |
| `src/renderer/videoEditor/videoEditor.ts` | IIFE 内接入采集与停止、帧循环上报时间戳、录制面板音频控件（设备勾选/系统内录/电平条）、`runTransform` 尾部构建变换音频、`playEl/pause/playEnd` 挂预览音频播放、`saveWebm/saveMp4` 加音轨 |
| `lib/translate/source.json` | 新增文案 id（`node lib/translate/tool.js -u`） |
| `docs/use/record.md` | 去掉「超级录屏不支持录制声音」 |
| `docs/develop/superRecorder.md` | 增加音频一节，链接本文档 |

### 实施顺序（对应提交，格式：超级录屏 xxx）

1. `超级录屏 录音功能实现计划` —— 本文档。
2. `超级录屏 录制采集音频` —— `audio.ts` 采集 + 编码 + 时钟偏移，接入录制 IIFE 与停止流程。
3. `超级录屏 录制面板音频控制` —— 设备勾选、系统内录开关、实时音量电平，持久化 `录屏.音频.设备列表`。
4. `超级录屏 音频跟随时间轴编辑` —— 解码源 PCM、`buildTransAudio`（删除/变速）、接入 `runTransform`。
5. `超级录屏 预览播放声音` —— 播放/暂停/结束/跳转同步。
6. `超级录屏 导出视频包含音频` —— mp4/webm 加音轨 + codec 回退 + 未包含提示。
7. `超级录屏 播放前等待转场同步` —— 修复预览播放与 `afterTrans()` 中 `playDecoder.flush()` 的竞态（端到端测试中稳定复现，会让预览卡死）。
8. `超级录屏 音频分段合并优化` —— 相邻同速帧合并成段，避免逐帧建几十万个节点。
9. `超级录屏 音频功能文档与端到端测试` —— 使用文档、设计文档、`test/superRecorderAudioE2E.mjs`。

每个提交都跑 `pnpm run format`、`pnpm run typecheck`、`pnpm run lint`。

### 端到端测试

`test/superRecorderAudioE2E.mjs` 用 CDP 驱动打包后的真实应用自动跑完整链路（fake 音频设备，不需要麦克风）：

```shell
pnpm run build
node test/superRecorderAudioE2E.mjs   # 全部通过 exit 0，有失败 exit 1
```

脚本会自建临时 userData、清理上次残留的 Electron（含被中断的运行）、启动时占用的调试端口冲突会先被清掉；结束或被中断时都会回收整个 Electron 进程组，不会留下孤儿进程。

## 已知限制 & 后续优化

- [x] **变速会变调**：已实现 `timeStretch`（WSOLA，见 `audio.ts`）time-stretch，加速/减速都保持音高。`AudioBufferSourceNode` 没有 `preservesPitch`（Chromium 152 实测，只有 `HTMLMediaElement` 有），Web Audio 也没有别的可用 API，只能自己实现。
- [ ] **变速段接缝精度**：分析帧在输出内按 1:1 推进，段尾的源内容位置与相邻段起点最多差一个分析步长（≈10~20ms）。已有越界保护（取下一段源音频，缺失时下一段淡入）避免尾部塌陷与爆音，但瞬态处仍可能听出拼接痕迹。
- [ ] **A/V 对齐精度**：目前依赖两路最小延迟差（约 10~30ms）。后续可在录制首帧时做一次音频脉冲校准，或直接统一使用采集时间戳纪元（需实测 Chrome 各平台行为）。
- [ ] **时间轴音轨可视化**：波形/静音区间显示（可用 `timeLineTrack` 工厂或独立 canvas 层），并支持单段静音。
- [ ] **单独导出音频**（m4a/opus/wav）。
- [ ] **mp4 音频优先 AAC**：Linux 上 WebCodecs 通常不能编 AAC，会回退 opus（部分播放器不认），后续可考虑接入 ffmpeg 兜底（已有录屏（旧）的 ffmpeg 打包链路）。
- [ ] **录制面板之外的录制前配置**：目前设备选择在设置（持久化）与录制面板（实时）两处，若要「点开即选」，需给超级录屏加一个录制确认页。
- [ ] **内存预算**：`encodeSize` 只统计视频，音频（≈1MB/min + 变换 PCM）未纳入停止/告警计算。

## 测试要点

已由 `test/superRecorderAudioE2E.mjs`（CDP 驱动真实构建 + Chromium fake 音频设备）验证：

- [x] 录制面板出现、麦克风按钮展开设备列表、勾选设备、实时电平、选择持久化到 `录屏.音频.设备列表`。
- [x] 只麦克风录制出 opus 音频，预览播放创建 `AudioBufferSourceNode` 并从当前媒体时间出声。
- [x] mp4、webm 导出均含 opus 音轨，`ffprobe` 时长与视频一致、频谱与源信号（440/660/880Hz）比例一致（无采样率/音高错误）。
- [x] 没有任何音频输入时，录制、变换、导出与原行为一致（不回归）。

待人工验证（需要真实硬件/系统内录）：

- [ ] 系统内录（真实 loopback，含 `启用系统内录` 关闭时面板置灰提示）。
- [ ] 录制中取消已勾选设备：设备释放（系统隐私指示灯熄灭）、后续文件时长正确。
- [ ] 删除区间、变速区间后音画同步（变速段落有声且时长与画面一致，快放/慢放人声均不变调）。
- [ ] 变速段与相邻段的接缝处无爆音、无明显拼接痕迹（含接删除区间时的淡入）。
- [ ] 暂停/上一帧/下一帧/时间轴跳转后声音位置正确；播放到结尾停止。
- [ ] 双麦克风混音；无音频输入设备时的提示文案。
- [ ] gif/apng/png 导出不受影响；取消录制后设备释放。
