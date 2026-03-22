import * as SQLite from 'expo-sqlite';

// 打开或创建本地数据库文件
const db = SQLite.openDatabaseSync('hacker_brain.db');

export const initDB = () => {
  // 创建文档表和 Anki 闪卡表
  db.execSync(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      uri TEXT,
      content TEXT,
      import_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id INTEGER,
      front TEXT,
      back TEXT,
      interval INTEGER DEFAULT 0,
      repetition INTEGER DEFAULT 0,
      ease_factor REAL DEFAULT 2.5,
      next_review DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ 本地 SQLite 数据库初始化成功！");
};

export const getDB = () => db;