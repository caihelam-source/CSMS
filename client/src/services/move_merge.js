const fs = require('fs');
const p = 'c:/Users/Vincent/WorkBuddy/Claw/client/src/services/mock.js';
let c = fs.readFileSync(p, 'utf8');

// Find merge method start
const start = c.indexOf('  // Merge two personnel');
if (start < 0) { console.log('merge start not found'); process.exit(1); }

// Find merge method end: next '\n  },\n' after start
const endMarker = '\n  },\n';
let end = c.indexOf(endMarker, start);
if (end < 0) { console.log('merge end not found'); process.exit(1); }
end += endMarker.length;

const mergeMethod = c.substring(start, end);
console.log('Extracted merge method, length:', mergeMethod.length);

// Remove from companies object
c = c.substring(0, start) + c.substring(end);

// Find personnel object's delete line
const persDelete = '  delete: async (id) => { await delay(); return { data: { data: { _id: id } } };\n';
const delIdx = c.indexOf(persDelete);
if (delIdx < 0) { console.log('personnel delete line not found'); process.exit(1); }

// Insert merge method after delete line
const before = c.substring(0, delIdx + persDelete.length);
const after = c.substring(delIdx + persDelete.length);
const newContent = before + '\n' + mergeMethod + after;

fs.writeFileSync(p, newContent, 'utf8');
console.log('Done - moved merge method to personnel object');
