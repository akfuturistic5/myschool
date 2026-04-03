const fs = require('fs');

try {
    const data = JSON.parse(fs.readFileSync('lint_errors.json', 'utf8'));
    const rules = {};
    const files = {};
    let totalErrors = 0;

    data.forEach(result => {
        if (result.errorCount > 0 || result.warningCount > 0) {
            files[result.filePath] = (files[result.filePath] || 0) + result.errorCount + result.warningCount;
            result.messages.forEach(msg => {
                rules[msg.ruleId] = (rules[msg.ruleId] || 0) + 1;
                totalErrors++;
            });
        }
    });

    console.log(`Total Problems: ${totalErrors}`);
    console.log('\nTop Rules:');
    Object.entries(rules).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([rule, count]) => {
        console.log(`  ${rule}: ${count}`);
    });

    console.log('\nTop Files by Error Count:');
    Object.entries(files).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([file, count]) => {
        console.log(`  ${file}: ${count}`);
    });
} catch (e) {
    console.error(e);
}
