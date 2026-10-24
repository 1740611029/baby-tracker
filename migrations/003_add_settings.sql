-- 003: 设置项改为服务端存储（全局单租户，单行 JSON）
-- 已有库执行一次：npx wrangler d1 execute baby-tracker-db --local --file=./migrations/003_add_settings.sql
-- 线上：npx wrangler d1 execute baby-tracker-db --remote --file=./migrations/003_add_settings.sql
--
-- 刻意不预置默认行：
-- 表为空时 GET /api/settings 返回 empty=true，前端会把本地 localStorage 里的设置上传，
-- 避免升级时用默认值覆盖用户自己加过的快捷词。

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
