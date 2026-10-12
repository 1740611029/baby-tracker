CREATE TABLE IF NOT EXISTS feedings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_time TEXT NOT NULL,
  amount_ml INTEGER NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image TEXT DEFAULT '',
  done INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  due_time TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  images TEXT DEFAULT '[]',
  pinned INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_time TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedings_time ON feedings(feed_time DESC);
CREATE INDEX IF NOT EXISTS idx_todos_pinned ON todos(pinned DESC, done ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_pinned ON memos(pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(event_time DESC);
