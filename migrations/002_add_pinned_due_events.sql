-- 002: 待办置顶/时间、备忘置顶、新增事件表
-- 已有库执行一次：npx wrangler d1 execute baby-tracker-db --local --file=./migrations/002_add_pinned_due_events.sql
-- 线上：npx wrangler d1 execute baby-tracker-db --remote --file=./migrations/002_add_pinned_due_events.sql

ALTER TABLE todos ADD COLUMN pinned INTEGER DEFAULT 0;
ALTER TABLE todos ADD COLUMN due_time TEXT;
ALTER TABLE memos ADD COLUMN pinned INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_time TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_time ON events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_todos_pinned ON todos(pinned DESC, done ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_pinned ON memos(pinned DESC, updated_at DESC);
