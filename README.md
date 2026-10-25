# 宝宝成长记录 🍼

移动端网页应用：喂奶记录（到点页面内提示）、待办事项（可附截图、勾选完成）、图文备忘录。

技术栈：Vue 3 + Vite + Cloudflare Pages (Functions + D1)。图片客户端 Canvas 压缩后 base64 存 D1，无需第三方图床，全程免费。

设计与需求文档见 `docs/项目描述.md` 与 `docs/design/设计图.html`。

## 本地开发

```bash
npm install

# 初始化本地 D1
npx wrangler d1 execute baby-tracker-db --local --file=./schema.sql

# 已有库增量迁移（新库执行过 schema.sql 就不用再跑）
npx wrangler d1 execute baby-tracker-db --local --file=./migrations/003_add_settings.sql
```

前后端联调（两个终端）：

```bash
# 终端 1：构建前端并启动 API + 静态服务（改动前端后重新 npm run build）
npm run build
npx wrangler pages dev --port 8788
# 访问 http://localhost:8788（最接近线上环境）

# 终端 2（可选，需要 HMR 时）：Vite 开发服务器，/api 已代理到 8788
npm run dev
# 访问 http://localhost:5173
```

## 部署（Git 集成自动部署）

1. 创建 D1 数据库并初始化：

   ```bash
   npx wrangler d1 create baby-tracker-db
   # 把返回的 database_id 填入 wrangler.toml
   npx wrangler d1 execute baby-tracker-db --file=./schema.sql
   ```

2. 推送代码到 GitHub 仓库。

3. Cloudflare Dashboard → Pages → Create a project → Connect to Git，选择仓库：
   - 构建命令：`npm run build`
   - 输出目录：`dist`

4. Pages 项目 → Settings → Functions → D1 database bindings：
   - 变量名：`DB`，数据库：`baby-tracker-db`

5. 之后每次 push 到 main 分支自动构建部署。

> **已有库升级**：Pages 一次部署会同时上线前端和 Functions，所以表结构变更必须**先跑远端迁移再 push**，否则接口会 500（前端会退化成离线状态，继续用本地缓存）。
>
> ```bash
> npx wrangler d1 execute baby-tracker-db --remote --file=./migrations/003_add_settings.sql
> ```

## 设置同步

设置（喂奶间隔 / 展示时长 / 快捷奶量 / 快捷备注词 / 快捷事件）存 D1 的 `settings` 表，全局单租户，只有 `id=1` 这一行，内容整体存成 JSON。

- `GET /api/settings`：返回 `{ ok, empty, settings, updatedAt }`。`empty=true` 表示云端还没有设置
- `POST /api/settings`：全量覆盖写入，服务端会重新归一化（间隔 1~12 步进 0.5、窗口 1~72、奶量 1~999 最多 8 个、快捷词 ≤10 字最多 8 个），返回归一化后的结果
- 前端 `src/utils/settings.js` 里 `settings` 仍是同步的 reactive 单例，`localStorage` 只做首屏缓存与离线兜底
- 改设置是**乐观更新**：点一下立刻变，120ms 内的连续操作合并成一次提交，失败则回滚到上一次服务端确认值并提示
- **首次升级**：云端为空时，前端会把本机现有配置上传一次，不会用默认值覆盖用户自己加过的快捷词。所以迁移**不预置默认行**

## 喂奶数据保留策略

- 首页只展示「近 N 小时（默认 12，设置页可调 1~72）∪ 最近 6 条」的喂奶记录，由 `GET /api/feedings?hours=N` 直接裁好
- 每次打开时，前端调用 `POST /api/cleanup` 删除超出窗口的喂奶记录；窗口由**服务端从 `settings` 表读取**（不再接受前端传参），`keep=6` 也硬编码在服务端，最坏也只删到剩最近 6 条
- `settings` 表还没有数据时，cleanup 直接跳过删除，不会用默认 12 小时误删用户本意更长的记录
- 删完只有**停在喂奶列表页**（且弹层没打开）才重拉列表；其他页面只删不刷，切回喂奶页时由进入页面时的请求自然覆盖
- **只清理 `feedings`，`events` 永不删除**（事件只按窗口过滤展示）
- 删除不可逆、无回收站。上线前建议备份：`npx wrangler d1 export baby-tracker-db --remote --output=backup.sql`
- 「距上次喂奶」= max(最近一条喂奶记录, 最近一次标题含「母乳/亲喂/瓶喂」的事件)

## 性能约定（别改回去）

图片以 base64 存 D1，备忘压缩档位 1024px / JPEG 0.65，单张约 80~160KB（一次最多 9 张，合计控制在 1MB 出头），因此：

- 列表/详情接口不返回图片本体，返回 `/api/xxx/image/:id` 地址按需加载
- 图片接口带 ETag，未修改返回 304
- **编辑备忘时详情接口返回 `images: ['/api/memo/image/:id/0', ...]` 地址数组**，保存时原样回传地址，服务端按索引取回原 base64，只有新增的图进请求体
  - 这一点是 408 的根因修复：早期前端用 `?raw=1` 拉回全部 base64 再全量回传，8 图备忘新增 1 张就有 2.4MB 请求体，弱网下 body 没传完就被 Cloudflare 边缘判超时（408，请求根本没进 Worker）
  - `?raw=1` 保留，但只作调试用，业务代码不要用
  - 前端只支持「追加」和「删除」图片，地址索引始终指向旧数组，删除中间一张后回传 `[/0, /2]` 不会错位
- 服务端有体积护栏（`functions/utils.js` 的 `IMAGE_LIMITS`）：单张 > 400KB 或合计 > 1.7MB 返回 413。D1 单行/单字符串硬上限是 2MB，超了会报 500，护栏是为了把错误提前成可读提示
- 图片接口用 `json_extract` 只取第 idx 张，不再把整行所有图片的 base64 搬进 Worker；`json_valid` 保护 + 整行解析兜底，脏数据仍能显示
- 前端请求 30 秒超时（body > 120KB 时放宽到 60 秒）；GET / DELETE（幂等）网络失败会自动等网络恢复后重试 1 次，POST 默认不重试（避免重复写入），只有整行覆盖的备忘编辑接口显式传 `retry: true` 才会重试
- 408 / 502 / 503 / 504 是边缘返回的 HTML 错误页，取不到 `body.error`，单独映射成「网络太慢，数据没传完，请重试」
- 页面路由一律**静态导入**，不做代码分包：整站 JS 约 120KB，分包只会让每次切页多一次网络往返，弱网下正是它失败（`Failed to fetch dynamically imported module`）
- `public/_headers` 让 `index.html` 走 `no-cache`、`/assets/*` 长缓存，避免发版后旧 HTML 指向已删除的分包
- `index.html` 内置启动兜底：脚本加载失败自动刷新一次，仍失败则显示「重新加载」按钮，不停在白屏
