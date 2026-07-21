/**
 * Claw - 存储适配器
 * 根据 STORAGE_DRIVER 环境变量切换：
 *   - 'local' (默认): 本地磁盘 uploads/documents/
 *   - 'r2': Cloudflare R2 对象存储（持久化，跨服务重启不丢失）
 *
 * 接口统一：
 *   upload(stream/buffer, key, contentType) -> { url, key, size }
 *   delete(key) -> void
 *   getUrl(key) -> string (用于下载/预览)
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const LOCAL_DIR = path.join(__dirname, '../../uploads/documents');

function genKey(originalName) {
  const ext = path.extname(originalName || '');
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
}

// ── Local Driver ─────────────────────────────────────────────
const localDriver = {
  name: 'local',
  async upload(file, originalName, _contentType) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    const key = genKey(originalName);
    const dest = path.join(LOCAL_DIR, key);
    fs.writeFileSync(dest, file); // file = Buffer
    return {
      key,
      url: `/uploads/documents/${key}`,
      size: Buffer.isBuffer(file) ? file.length : 0,
    };
  },
  async delete(key) {
    const p = path.join(LOCAL_DIR, key);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  },
  getUrl(key) {
    return `/uploads/documents/${key}`;
  },
};

// ── Cloudflare R2 Driver ─────────────────────────────────────
let r2Client = null;
let R2 = null;

function getR2() {
  if (r2Client) return r2Client;
  // 延迟加载，避免未配置时报错
  const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
  r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  R2 = { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand };
  return r2Client;
}

const r2Driver = {
  name: 'r2',
  async upload(file, originalName, contentType) {
    const s3 = getR2();
    const key = genKey(originalName);
    const bucket = process.env.R2_BUCKET_NAME;
    await s3.send(new R2.PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: contentType || 'application/octet-stream',
    }));
    // 公共访问 URL（R2 桶需设为公开或配置自定义域）
    const base = process.env.R2_PUBLIC_URL || `${process.env.R2_ENDPOINT.replace('https://', 'https://pub.')}/`;
    return {
      key,
      url: `${base.replace(/\/$/, '')}/${key}`,
      size: Buffer.isBuffer(file) ? file.length : 0,
    };
  },
  async delete(key) {
    const s3 = getR2();
    await s3.send(new R2.DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    }));
  },
  getUrl(key) {
    const base = process.env.R2_PUBLIC_URL || `${process.env.R2_ENDPOINT.replace('https://', 'https://pub.')}/`;
    return `${base.replace(/\/$/, '')}/${key}`;
  },
};

// ── 选择驱动 ─────────────────────────────────────────────────
const driver = (process.env.STORAGE_DRIVER || 'local') === 'r2' ? r2Driver : localDriver;

console.log(`📦 Storage driver: ${driver.name}`);

module.exports = {
  storage: driver,
  genKey,
};
