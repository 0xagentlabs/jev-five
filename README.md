# Jev Five

一个使用 TypeSafe AI 官方 Jev System One API 驱动的五子棋演示。支持“人类 vs Jev”、“Jev vs Jev”，以及可通过邀请链接让两位玩家加载各自 Jev 的 **Jev Fighting** 房间模式，并展示每一步的结构化选择、置信度、候选概率和延迟。

在线体验：[jev-five-ten.vercel.app](https://jev-five-ten.vercel.app)

## 本地运行

要求 Node.js 20+ 与 pnpm。

```bash
pnpm install
cp .env.example .env.local
# 在 .env.local 中填写 TYPESAFE_API_KEY
pnpm dev
```

官方密钥在 [TypeSafe Console](https://console.typesafe.ai/keys) 创建。应用会优先读取浏览器 `localStorage`，没有密钥时才显示输入框；请求通过 HTTPS 发送给服务端 API Route，不会进入仓库或构建产物。

Jev Fighting 位于 `/fighting`。生产环境使用项目绑定的私有 Vercel Blob 保存 24 小时房间状态；本地开发需在 `.env.local` 配置 `BLOB_READ_WRITE_TOKEN`。玩家的 TypeSafe API Key 不写入房间存储。

## 验证

```bash
pnpm lint
pnpm test
pnpm build
```

## Jev 集成

- 官方 SDK：`@typesafe-ai/sdk`
- 模型：`jev-latest`
- 原语：`choice()`
- 环境变量：`TYPESAFE_API_KEY`
- 混合棋力引擎先处理必胜与必防，再识别活四、跳四、眠四、四三杀、双活三、跳活三与活二，并通过选择性三层搜索评估双方最佳延续，筛选最多 14 个候选交给 Jev `choice()` 决策。
- 服务端再次校验 Jev 返回坐标的合法性后才落子。
