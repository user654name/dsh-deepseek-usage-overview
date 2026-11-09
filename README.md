**简体中文** | [English](README.en.md)

# dsh-deepseek-usage-overview

**在 DeepSeek Harness 里直接查看 DeepSeek 平台用量 —— 不再跳浏览器、不再手动对账。**

这是一个面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI 的**内页用量面板**：
在 Harness 内部展示与 `platform.deepseek.com/usage` 相同的信息 —— 充值余额、累计消费、
消费金额 / API 请求次数 / Tokens、以及消费柱状图。侧边栏「用量」按钮或双击右下角即可打开。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platform: DeepSeek Harness Web](https://img.shields.io/badge/platform-DeepSeek%20Harness%20Web-4D6BFE)
![Node: >=20](https://img.shields.io/badge/node-%3E%3D20-339933)

---

## 目录

- [为什么需要它](#为什么需要它)
- [功能](#功能)
- [工作原理](#工作原理)
- [安装](#安装)
- [使用](#使用)
- [安全与隐私](#安全与隐私)
- [配置](#配置)
- [开发](#开发)
- [测试](#测试)
- [常见问题](#常见问题)
- [已知限制](#已知限制)
- [许可证](#许可证)

## 为什么需要它

平时查看 DeepSeek 余额和用量，需要离开 Harness、打开平台网页、重新登录、再点到用量页。
本插件用 **DSH 里已经登录的 DeepSeek 账号**，把平台用量页直接搬进 Harness：

- 不用二次登录，不用配置 API Key；
- 不新开浏览器标签页；
- 展示的是 DeepSeek 实际计费口径的数据，而不是本地估算。

> 与常见的同类插件不同：本插件不要求复制 Platform `userToken`，也不从本地会话日志估算费用，
> 而是通过 DSH 已登录账号直接读取 DeepSeek 平台计费接口，因此展示的是平台真实余额与账单口径的用量。

## 功能

- **三种打开方式**
  - 侧边栏底部「用量」快捷按钮（设置按钮旁）；
  - 设置页标题栏「用量」按钮（关闭按钮旁）；
  - **双击窗口右下角**（如果装了右下角小鲸鱼挂件，双击鲸鱼身体同样生效）。
- **真正的 DSH 内页**：注册在 `shell.overlay` 的 React 视图，使用 Harness 主题 token，
  自动跟随明暗主题与语言，不是 iframe、也不是新标签页。
- **余额卡片**：充值余额、赠送余额（有则显示）、平台余额预警状态、「去充值」入口。
- **累计消费卡片**：账户币种的平台累计消费。
- **时间维度**：今天 / 昨天 / 近 7 天 / 近 30 天 / 本月。
- **API Key 筛选**：所有数字与图表可只看某一个 Key。
- **汇总卡片**：所选时间与 Key 的消费金额、API 请求次数、Tokens。
- **消费柱状图**：今天按小时、更长区间按天；可在「调用类型（模型调用 / 工具调用）」与
  「按 API Key」两种分组间切换。
- **CSV 导出**：导出当前筛选下的明细。
- **中英双语**：跟随 Harness 当前语言。
- **无需构建**：浏览器半区是手写的 `window.__ModuleLoader__` bundle。

## 工作原理

```
┌───────────────────────────────  浏览器（Harness Web UI）  ───────────────────────────────┐
│  侧边栏按钮 / 设置页按钮 / 右下角双击                                                   │
│        │                                                                                │
│        ▼                                                                                │
│  内页用量面板（React，shell.overlay）  ──  fetch GET /api/deepseek-usage/overview ──┐    │
└────────────────────────────────────────────────────────────────────────────────────┼────┘
                                                                                     │
┌──────────────────────────────  DSH Host（Node）  ─────────────────────────────────▼────┐
│  dsh-deepseek-usage-overview 宿主半区                                                           │
│    • 仅本机回环、仅 GET 的 HTTP 路由                                                   │
│    • deepseekAccount.getPlatformSession() 取得已登录账号凭据                           │
│    • 请求平台用量页自己使用的私有接口：                                                │
│        GET /api/v0/users/get_user_summary                                             │
│        GET /auth-api/v0/users/current                                                 │
│        GET /api/v0/usage/by_api_key/amount                                            │
│        GET /api/v0/usage/by_api_key/cost                                              │
│    • 把 amount + cost 折叠成小时/天桶并聚合                                             │
│    • 结果在内存中缓存 30 秒                                                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                     │
                                                       platform.deepseek.com  ◄──────┘
```

浏览器拿到的只有聚合后的数字和 API Key 名称，**不会**收到账号 token、部署 Cookie 或平台原始响应。

### 接口

```
GET /api/deepseek-usage/overview?start=<unix 秒>&end=<unix 秒>&tz=<东偏移秒数>&lang=zh|en[&refresh=1]
```

路由只接受 **loopback 对端**（127.0.0.1 / ::1），只允许 `GET`，并做 30 秒内存缓存
（`refresh=1` 绕过）。非本机请求返回 403，非 GET 返回 405。

## 安装

前置条件：

- DeepSeek Harness 的 Web GUI（`@deepseek-ai/dsh >= 0.2.2`），Node.js 20+；
- 已在 DSH「设置 → 账号与余额」登录 DeepSeek 账号。本插件读取的是**平台账号凭据**，
  仅配置推理用 `DEEPSEEK_API_KEY` 不够。

从 GitHub 安装（推荐）：

```bash
dsh plugin --profile <profile> add github:user654name/dsh-deepseek-usage-overview
```

从本地目录安装：

```bash
dsh plugin --profile <profile> add /绝对路径/dsh-deepseek-usage-overview
```

或在 DSH 会话里让 Agent 安装该目录对应的 bundle。安装后**刷新一次 Web 页面**（`Ctrl+F5`）。

常见 profile：桌面端用 `desktop`，`dsh web` 用 `web`。

> 插件以 **bundle** 形式安装：`cordis.patch.yml` 挂载宿主半区，`package.json` 的 `dsh.client`
> 声明浏览器半区，除此之外无需额外配置。

## 使用

| 入口 | 位置 |
| --- | --- |
| 「用量」侧边栏按钮 | 侧边栏页脚、设置按钮旁（侧边栏收起时只显示图标） |
| 「用量」设置页按钮 | 设置面板标题栏、关闭按钮旁 |
| 右下角双击 | 窗口右下角 200 px 区域内双击；小鲸鱼挂件身体上的双击同样生效，按钮 / 输入框等控件保持原行为 |

页面内容：

| 区块 | 内容 |
| --- | --- |
| 余额 | 充值余额、赠送余额、余额预警状态、去充值 |
| 累计消费 | 账户币种的累计消费金额 |
| 筛选 | 时间维度、API Key、清除筛选、CSV 导出 |
| 汇总 | 消费金额、API 请求次数、Tokens |
| 图表 | 消费柱状图，按调用类型或 API Key 分组 |

## 安全与隐私

- **凭据不进浏览器**：账号 grant 只在 Host 侧使用；HTTP 响应只有聚合数字与 Key 显示名。
- **仅本机回环**：按 peer socket 地址判断（`127.0.0.1` / `::1`），`Host` 头作为附加防线。
- **固定上游**：只请求账号服务提供的 origin（通常 `https://platform.deepseek.com`），强制
  HTTPS、禁止重定向、15 秒超时、4 MiB 响应上限。
- **不落盘**：不持久化任何凭据或用量数据，只有 30 秒内存缓存。
- **无 CORS 头**：只读、同源，外部页面无法读取响应。

平台这些私有接口与官方用量页同源同鉴权，未公开、可能变更。

## 配置

不需要配置。插件行以空配置挂载：

```yaml
- insert:
    - id: deepseek-usage
      name: dsh-deepseek-usage-overview
      config: {}
```

宿主半区只依赖 Harness 的 `webServer` 服务，并可选读取 `deepseekAccount`。未登录或没有账号服务时，
页面会显示本地化的「未登录」状态。

## 开发

```text
dsh-deepseek-usage-overview/
├── index.js              # 宿主半区：路由、平台请求、聚合、回环校验
├── client.js             # 浏览器半区：手写 __ModuleLoader__ bundle（无构建）
├── cordis.patch.yml      # 挂载宿主半区的 bundle patch
├── package.json          # 清单（bundle + dsh.client）
├── locale/{zh,en}.json   # 插件管理页展示元数据
├── icon.svg              # 插件图标
├── test/                 # 离线测试（宿主聚合 + 客户端渲染）
└── README.md（中文）/ README.en.md（English）
```

```bash
pnpm install     # 仅开发依赖（客户端渲染测试需要 React）
pnpm run check   # node --check index.js client.js
pnpm test        # 离线测试（node:test）
```

### 样式约定

- UI 文案全部走 Harness locale 服务（`ctx.locale`）。
- 颜色与表面使用 Harness 主题 token（`--dsw-alias-*`），图表柱色使用插件自有颜色。
- 页面注册在 `shell.overlay`，侧边栏快捷入口注册在 `sidebar.footer.action`，设置页入口注册在
  `settings.action`。
- 不把任何 Harness Client 包作为模块引入。

## 测试

`pnpm test` 使用 `node:test` 运行离线测试：

- **宿主半区**：回环校验、参数校验、amount/cost 聚合、币种与余额选择、token 不进入浏览器响应。
- **客户端半区**：用 React 18（`react-dom/server`）真实渲染空状态、有数据、Key 过滤、切换区间，
  并断言所有 JSX 调用都传了 props 对象（曾导致开发版 jsx-runtime 崩溃的回归点）。

CI 在每次 push 时运行同样的命令（GitHub Actions）。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 点按钮没反应 / 不弹窗 | 强制刷新一次 Web 页面（`Ctrl+F5`），浏览器会缓存客户端 bundle。 |
| 显示「未登录 DeepSeek 账号」 | 到「设置 → 账号与余额」登录后重新打开。 |
| 余额正常但用量为空 | 所选区间平台没有用量数据，或账号还没有 API 调用。 |
| 顶部出现「用量明细暂时不可用」 | 某个私有接口失败；余额与累计消费仍会显示，可点刷新重试。 |
| 数字和平台页对不上 | 平台数据最多延迟 5 分钟，页面再缓存 30 秒；点刷新。 |
| 页面渲染失败 | 页面会显示错误面板和「复制错误详情」按钮，把内容贴到 issue 即可。 |

## 已知限制

- 需要 DeepSeek **账号登录**（仅 API Key 的场景不支持）。
- 只展示平台暴露的 CNY / USD 钱包；多币种账户取账户币种，缺失时退到第一个有用量的币种。
- 平台私有用量接口未公开，平台侧变更可能导致页面失效；届时页面会降级为余额 + 累计消费，而不是整页崩溃。
- 右下角双击热区故意放宽到 200 px（覆盖小鲸鱼挂件），角内可交互控件不会被误触发（精确 44 px 角除外）。
- 更新客户端 bundle 后需要刷新页面（Electron 端不会热更新已安装插件的客户端代码）。

## 许可证

[MIT](LICENSE)

---

为 DeepSeek Harness 社区而做。欢迎 issue 与 PR。
