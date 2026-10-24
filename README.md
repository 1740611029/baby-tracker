# 宝宝成长记录 🍼

移动端网页应用：喂奶记录（到点页面内提示）、待办事项（可附截图、勾选完成）、图文备忘录。

技术栈：Vue 3 + Vite + Cloudflare Pages (Functions + D1)。图片客户端 Canvas 压缩后 base64 存 D1，无需第三方图床，全程免费。

设计与需求文档见 `docs/项目描述.md` 与 `docs/design/设计图.html`。

## 本地开发

```bash
npm install

# 初始化本地 D1
npx wrangler d1 execute baby-tracker-db --local --file=./schema.sql
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

## 喂奶数据保留策略

- 首页只展示「近 N 小时（默认 12，设置页可调 1~72）∪ 最近 6 条」的喂奶记录，由 `GET /api/feedings?hours=N` 直接裁好
- 每次打开时，前端调用 `POST /api/cleanup` 删除超出窗口的喂奶记录；`keep=6` 硬编码在服务端，最坏也只删到剩最近 6 条
- 删完只有**停在喂奶列表页**（且弹层没打开）才重拉列表；其他页面只删不刷，切回喂奶页时由进入页面时的请求自然覆盖
- **只清理 `feedings`，`events` 永不删除**（事件只按窗口过滤展示）
- 删除不可逆、无回收站。上线前建议备份：`npx wrangler d1 export baby-tracker-db --remote --output=backup.sql`
- 「距上次喂奶」= max(最近一条喂奶记录, 最近一次标题含「母乳/亲喂/瓶喂」的事件)

## 性能约定（别改回去）

图片以 base64 存 D1，单张 100~250KB，因此：

- 列表/详情接口不返回图片本体，返回 `/api/xxx/image/:id` 地址按需加载
- 图片接口带 ETag，未修改返回 304
- 编辑时取原图用 `?raw=1`；保存时 `/api/` 开头的 image 视为未修改，保持原图
- 前端请求 30 秒超时；GET / DELETE（幂等）网络失败会自动等网络恢复后重试 1 次，POST 不重试（避免重复写入）
- 页面路由一律**静态导入**，不做代码分包：整站 JS 约 120KB，分包只会让每次切页多一次网络往返，弱网下正是它失败（`Failed to fetch dynamically imported module`）
- `public/_headers` 让 `index.html` 走 `no-cache`、`/assets/*` 长缓存，避免发版后旧 HTML 指向已删除的分包
- `index.html` 内置启动兜底：脚本加载失败自动刷新一次，仍失败则显示「重新加载」按钮，不停在白屏
