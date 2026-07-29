async function main() {
  const loginRes = await fetch('https://claw-api-5zq7.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hk1321@agent.qq.com', password: 'lin19900731' })
  });
  const login = await loginRes.json();
  const token = login.token;
  if (!token) { console.log('login failed', login); return; }

  const listRes = await fetch('https://claw-api-5zq7.onrender.com/api/documents?limit=50', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const list = await listRes.json();
  console.log('total count:', list.count);
  for (const d of (list.documents || [])) {
    console.log('---');
    console.log('id:', d._id);
    console.log('name:', d.name);
    console.log('docNumber:', d.docNumber);
    console.log('filename:', d.filename);
    console.log('fileName:', d.fileName);
    console.log('fileUrl:', d.fileUrl);
    console.log('mimeType:', d.mimeType);
    console.log('fileSize:', d.fileSize);
    console.log('scope:', d.scope);
    console.log('company:', d.company?._id || d.company, d.company?.name);
  }
}
main().catch(e => console.error(e));
