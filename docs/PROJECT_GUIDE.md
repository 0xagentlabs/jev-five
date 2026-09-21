# Jev Five 使用说明

## 功能

Jev Five 是一个 15×15 五子棋体验站。人机模式允许玩家选择黑白棋；本地双引擎模式让两个策略预设自动对局；独立的 Jev Fighting 模块支持两位玩家通过分享链接加载各自的 Jev 并完成跨设备对战。决策台展示结构化结果，不展示虚构的思维链。

## 技术架构

- Next.js App Router + TypeScript
- `app/api/move/route.ts`：仅服务端调用官方 TypeSafe SDK
- `lib/game.ts`：棋盘、胜负、坐标和合法性规则
- `app/page.tsx`：两种对局状态机与界面
- `app/fighting/`：Jev Fighting 建房、等待室、Jev 向导、对战和重放界面
- `app/api/fighting/rooms/`：房间创建、加入、配置、开始及提交落子 API
- `lib/fighting.ts`：权威房间状态机、权限、轮次、合法落子和胜负判断
- `lib/fighting-store.ts`：使用 ETag 乐观并发控制的私有 Vercel Blob 房间存储
- 前端自带密钥：优先从当前浏览器 `localStorage` 读取，没有时弹窗获取，请求时经 HTTPS 发送给服务端代理
- `TYPESAFE_API_KEY`：可选的服务端默认密钥
- `BLOB_READ_WRITE_TOKEN`：Jev Fighting 必需；生产环境由已绑定的私有 Blob Store 自动注入

## 启动与配置

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

从 `https://console.typesafe.ai/keys` 获取密钥并写入 `.env.local`：

```text
TYPESAFE_API_KEY=你的密钥
BLOB_READ_WRITE_TOKEN=你的私有VercelBlob令牌
```

不要把 `.env.local` 提交到 Git。也可以直接点击页面右上角“配置 API Key”；密钥保存在当前浏览器的 `localStorage`，不会写入房间状态或分享链接，可随时从右上角清除。

## 操作

1. “人类 vs Jev”：选择执黑或执白，在空交叉点落子；轮到 Jev 时自动请求决策。
2. “Jev vs Jev”：点击开始后，Alpha（进攻）与 Beta（稳健）交替决策；可暂停或继续。
3. 重新开始：点击控制面板右上角重置按钮。
4. 未配置密钥：页面启动时自动弹出输入框；保存后即可请求 Jev，可随时从右上角重新配置或清除。

## Jev Fighting 操作

1. 打开 `/fighting`，填写游戏名称、昵称、席位和每步时限，点击“创建并获得邀请链接”。
2. 在等待室复制链接给对手。对手打开链接、填写昵称并加入空余席位；其他访问者以观众身份进入。
3. 双方分别点击“快速创建并载入 Jev”，填写自己的 TypeSafe API Key、Jev 名称并选择进攻、均衡或防守风格。
4. 页面用一张空棋盘调用 `POST /api/move` 验证 Key；测试通过后，只把 Jev 名称和风格写入房间，Key 仍只在玩家浏览器中。
5. 双方准备后，房主点击“开始 Fighting”。轮到某方时，该玩家浏览器调用自己的 Jev，然后把合法落子提交给权威房间状态机。
6. 页面每 1.5 秒同步房间；刷新后通过本地玩家令牌恢复席位。比赛结束后，同一链接保留完整棋谱供观看和重放。

房间有效期为创建后 24 小时。比赛期间双方页面必须保持在线；某方关闭页面时，对局停在其回合，重新打开原链接即可继续。玩家令牌为随机 256 位值，服务端仅保存 SHA-256 哈希；API 的公开响应不会返回令牌或哈希。

## API 约定

`POST /api/move` 接收 `board`（15×15 的 `black | white | null` 数组）、`stone` 与策略。浏览器自带密钥通过 `X-TypeSafe-API-Key` 请求头传输；若没有该请求头，服务端才读取 `TYPESAFE_API_KEY`。

Jev Fighting API：

- `POST /api/fighting/rooms`：创建房间并返回房主的一次性玩家令牌
- `GET /api/fighting/rooms/:roomId`：读取已脱敏的公开房间状态
- `POST /api/fighting/rooms/:roomId`：执行 `join`、`configure`、`start` 或 `move`

服务端使用固定 Blob 路径和 ETag 条件写入避免两个并发请求覆盖彼此。每次移动会重新校验玩家令牌、当前回合、坐标范围、空位和比赛状态；客户端返回的胜负结论不会被信任。

混合棋力管线会先直接锁定唯一必胜或必防点；普通局面识别连续棋形、开放端、活四、跳四、眠四、四三杀、双活三、跳活三、活二与中心控制，并通过选择性三层搜索计算“己方候选—对手最佳回应—己方最佳延续”。全盘随后压缩成最多 14 个带棋术标签和评分的候选，再交给 `jev-latest` 的 `choice()` 做最终选择。返回落点、置信度、前五候选、耗时、模型名与战术标签。服务端会再次校验坐标合法性，非法结果不会写入棋盘。

## 测试与构建

```bash
pnpm lint
pnpm test
pnpm build
```

已启动生产构建且本地已拉取 Blob 凭据时，可另开终端执行跨请求验证：

```bash
pnpm start
node scripts/verify-fighting.mjs
```

该脚本会真实创建房间、加入第二位玩家、载入两个 Jev 描述、开始比赛、提交一手棋并验证公开响应已移除私密令牌。

常见问题：503 表示未配置密钥；401/403 通常表示密钥无效或无 Jev 权限；502 会在界面显示上游错误并提供重试。Jev 仍可能做出较弱棋步，置信度是决策信号，不是必胜保证。

## 线上资源

- GitHub：`https://github.com/0xagentlabs/jev-five`
- Vercel 生产环境：`https://jev-five-ten.vercel.app`
- Jev 官方站点：`https://typesafe.ai`
- TypeSafe Console：`https://console.typesafe.ai/keys`

Vercel 项目已连接上述 GitHub 仓库的 `main` 分支，并绑定私有 `jev-fighting-rooms` Blob Store。生产环境不内置共享 TypeSafe 密钥，访问者需在自己的浏览器填入 API Key。
