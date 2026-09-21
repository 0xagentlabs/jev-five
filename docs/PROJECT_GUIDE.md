# Jev Five 使用说明

## 功能

Jev Five 是一个 15×15 五子棋体验站。人机模式允许玩家选择黑白棋；双引擎模式让两个不同策略说明的 Jev 实例自动对局。右侧决策台展示 Jev 返回的结构化结果，不展示虚构的思维链。

## 技术架构

- Next.js App Router + TypeScript
- `app/api/move/route.ts`：仅服务端调用官方 TypeSafe SDK
- `lib/game.ts`：棋盘、胜负、坐标和合法性规则
- `app/page.tsx`：两种对局状态机与界面
- 前端自带密钥：保存在当前浏览器 `sessionStorage`，请求时经 HTTPS 发送给服务端代理
- `TYPESAFE_API_KEY`：可选的服务端默认密钥

## 启动与配置

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

从 `https://console.typesafe.ai/settings/keys` 获取密钥并写入 `.env.local`：

```text
TYPESAFE_API_KEY=你的密钥
```

不要把 `.env.local` 提交到 Git。也可以直接点击页面右上角“配置 API Key”，密钥只在当前标签页会话存活；关闭标签页后需要重新输入。

## 操作

1. “人类 vs Jev”：选择执黑或执白，在空交叉点落子；轮到 Jev 时自动请求决策。
2. “Jev vs Jev”：点击开始后，Alpha（进攻）与 Beta（稳健）交替决策；可暂停或继续。
3. 重新开始：点击控制面板右上角重置按钮。
4. 未配置密钥：页面启动时自动弹出输入框；保存后即可请求 Jev，可随时从右上角重新配置或清除。

## API 约定

`POST /api/move` 接收 `board`（15×15 的 `black | white | null` 数组）、`stone` 与策略。浏览器自带密钥通过 `X-TypeSafe-API-Key` 请求头传输；若没有该请求头，服务端才读取 `TYPESAFE_API_KEY`。

混合棋力管线会先直接锁定唯一必胜或必防点；普通局面计算连续棋形、开放端、活四、双四、双活三、中心控制与对手下一层反击，把全盘压缩成最多 14 个带分析和评分的候选，再交给 `jev-latest` 的 `choice()` 做最终选择。返回落点、置信度、前五候选、耗时、模型名与战术标签。服务端会再次校验坐标合法性，非法结果不会写入棋盘。

## 测试与构建

```bash
pnpm lint
pnpm test
pnpm build
```

常见问题：503 表示未配置密钥；401/403 通常表示密钥无效或无 Jev 权限；502 会在界面显示上游错误并提供重试。Jev 仍可能做出较弱棋步，置信度是决策信号，不是必胜保证。

## 线上资源

- GitHub：`https://github.com/0xagentlabs/jev-five`
- Vercel 生产环境：`https://jev-five-ten.vercel.app`
- Jev 官方站点：`https://typesafe.ai`
- TypeSafe Console：`https://console.typesafe.ai/settings/keys`

Vercel 项目已连接上述 GitHub 仓库的 `main` 分支。当前生产环境不内置共享密钥，访问者可在前端填入自己的 TypeSafe API Key。
