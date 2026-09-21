# Jev Five

一个使用 TypeSafe AI 官方 Jev System One API 驱动的五子棋演示。支持“人类 vs Jev”和“Jev vs Jev”两种模式，并展示每一步的结构化选择、置信度、候选概率和延迟。

在线体验：[jev-five-ten.vercel.app](https://jev-five-ten.vercel.app)

## 本地运行

要求 Node.js 20+ 与 pnpm。

```bash
pnpm install
cp .env.example .env.local
# 在 .env.local 中填写 TYPESAFE_API_KEY
pnpm dev
```

官方密钥在 [TypeSafe Console](https://console.typesafe.ai/settings/keys) 创建。未配置时，应用会显示输入框。用户密钥仅保存在浏览器 `sessionStorage`，关闭标签页后清除；请求通过 HTTPS 发送给服务端 API Route，不会进入仓库或构建产物。也可继续使用服务端 `TYPESAFE_API_KEY`。

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
- 混合棋力引擎先处理必胜与必防，再以棋形评分、双威胁识别和两层反击检查筛选最多 14 个候选，最后交给 Jev `choice()` 决策。
- 服务端再次校验 Jev 返回坐标的合法性后才落子。
