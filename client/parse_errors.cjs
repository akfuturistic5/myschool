const fs = require('fs');
const data = JSON.parse(fs.readFileSync('errors_only.json', 'utf8'));
let out = '';
data.forEach(f => {
    if (f.errorCount > 0) {
        out += `\nFILE: ${f.filePath}\n`;
        f.messages.forEach(m => {
            out += `  Line ${m.line}:${m.column} - ${m.ruleId} - ${m.message}\n`;
        });
    }
});
fs.writeFileSync('parsed_errors.txt', out);
console.log('Done writing parsed_errors.txt');
