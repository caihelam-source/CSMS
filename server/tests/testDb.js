/**
 * 测试用 MongoDB 内存实例 helper（mongodb-memory-server）。
 *
 * 用法（在 node:test 中）：
 *   const { startTestDb, stopTestDb } = require('./testDb');
 *   test('...', async () => {
 *     await startTestDb();
 *     try { ... } finally { await stopTestDb(); }
 *   });
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

/** @type {import('mongodb-memory-server').MongoMemoryServer | null} */
let mongoServer = null;

/**
 * 启动内存 MongoDB 并连接 mongoose。
 * @returns {Promise<string>} 连接串
 */
async function startTestDb() {
  // mongodb-memory-server 的实例启动超时由 instance.launchTimeout 控制（默认 10s），
  // 顶层 timeout 选项不会传递给实例启动，故必须显式设置 instance.launchTimeout。
  // 实测冷启动约需 20s，此处留足余量。
  mongoServer = await MongoMemoryServer.create({ instance: { launchTimeout: 120000 } });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  return uri;
}

/**
 * 断开连接并停止内存实例。
 * @returns {Promise<void>}
 */
async function stopTestDb() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

module.exports = { startTestDb, stopTestDb };
