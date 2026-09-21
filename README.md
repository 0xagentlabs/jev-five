# Jev Five

一个使用 TypeSafe AI 官方 Jev System One API 驱动的五子棋演示。支持“人类 vs Jev”和“Jev vs Jev”两种模式，并展示每一步的结构化选择、置信度、候选概率和延迟。

## 本地运行

要求 Node.js 20+ 与 pnpm。

```bash
pnpm install
cp .env.example .env.local
# 在 .env.local 中填写 TYPESAFE_API_KEY
pnpm dev
```

官方密钥在 [TypeSafe Console](https://console.typesafe.ai/settings/keys) 创建。未配置时，应用会显示配置提示，密钥只由服务端 API Route 读取。

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
- 每次请求把所有合法空位定义为选择标准，服务端再次校验坐标合法性后才落子。
