// mongoUri.js — 安全化 MongoDB 连接串：自动转义密码中的特殊字符
//
// 背景：MongoDB Node 驱动要求 URI 中的密码必须 percent-encode（
// 含 @ / # : + ? & % 等字符时必须转义），否则会直接抛出
// "Password contains unescaped characters" 并导致进程退出。
// Atlas 自动生成的强密码几乎必然含特殊字符，粘贴原始密码即触发。
//
// 本工具让用户可以直接粘贴原始密码，服务端兜底转义，
// 避免每次轮换密码都要手动 URL-encode 的麻烦与出错。
//
// 解析策略：以「最后一个 @」作为 凭证/主机 分界（主机域名不含 @，
// 因此最后一个 @ 之后必为 host），凭证再按「第一个 :」拆出 user/password，
// 这样密码本身含 @ 也能正确识别并转义。
//
// 行为：
//   - 密码含未转义的特殊字符且未含任何 % 编码 → 自动 encodeURIComponent
//   - 密码已含 % 编码 → 视为已转义，原样返回（避免双重编码）
//   - 格式不符（无 @ 或无密码）→ 原样返回，交给驱动自行报错

function safeMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return uri;

  const m = uri.match(/^(mongodb(\+srv)?:\/\/)(.*)$/);
  if (!m) return uri;

  const prefix = m[1]; // mongodb(+srv)://
  const rest = m[3];   // user:password@host...

  const atIdx = rest.lastIndexOf('@');
  if (atIdx === -1) return uri; // 无凭证（如 mongodb://localhost:27017/db）

  const creds = rest.slice(0, atIdx);
  const host = rest.slice(atIdx + 1);

  const colonIdx = creds.indexOf(':');
  if (colonIdx === -1) return uri; // 只有 user 无密码

  const user = creds.slice(0, colonIdx);
  const password = creds.slice(colonIdx + 1);

  const hasSpecial = /[@:/?#[\]&]/.test(password);
  const hasEncoded = password.includes('%');

  if (hasSpecial && !hasEncoded) {
    return `${prefix}${user}:${encodeURIComponent(password)}@${host}`;
  }
  return uri;
}

module.exports = { safeMongoUri };
