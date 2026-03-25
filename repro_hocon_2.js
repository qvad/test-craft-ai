const fs = require('fs');
function parseHocon(content) {
  let result = content;
  // Remove comments
  result = result.replace(/\/\/.*$/gm, '');
  result = result.replace(/#.*$/gm, '');

  // Handle multi-line strings
  result = result.replace(/"""([\s\S]*?)"""/g, (_, str) => {
    const escaped = str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `"${escaped}"`;
  });

  // Convert HOCON to JSON-like
  result = result.replace(/^\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*=/gm, '"$1":');
  result = result.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*=/g, '$1"$2":');
  result = result.replace(/\s*=\s*/g, ': ');
  result = result.replace(/}\s*{/g, '},{');
  result = result.replace(/,\s*([}\]])/g, '$1');

  return result;
}

const hocon = fs.readFileSync('tests/yugabyte-chaos-consistency.hocon', 'utf8');
const jsonLike = parseHocon(hocon);
console.log(jsonLike);
try {
  JSON.parse(jsonLike);
  console.log('Valid JSON');
} catch (e) {
  console.log('Invalid JSON:', e.message);
}
