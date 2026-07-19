/* Cross-platform smoke checks.  Keep this dependency-free so CI can run it
 * before installing optional tooling or contacting Firebase/PayOS. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const root = __dirname;
let failures = 0;

function fail(message) {
    failures += 1;
    console.error(`ERROR: ${message}`);
}

console.log('=== YNDA Cross-platform Smoke Test ===');
console.log('Testing Node.js server load...');
try {
    require(path.join(root, 'index.js'));
    console.log('  OK: index.js loads');
} catch (error) {
    fail(`index.js: ${error.message}`);
}

console.log('Testing critical payment/rules invariants...');
try {
    const { asSafeAmount, MAX_AMOUNT } = require(path.join(root, 'lib', 'paymentFulfillment.js'));
    const valid = asSafeAmount(5000) === 5000 && asSafeAmount(MAX_AMOUNT) === MAX_AMOUNT;
    const invalid = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_AMOUNT + 1]
        .every(value => asSafeAmount(value) === null);
    if (!valid || !invalid) fail('payment amount validation invariant failed');

    const firestoreRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const storageRules = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');
    const databaseRules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'));
    if (!firestoreRules.includes('match /votes/{userId}') || !firestoreRules.includes('allow read, create, update, delete: if false;')) {
        fail('Firestore vote deny invariant is missing');
    }
    if (!storageRules.includes('request.auth.uid == userId') || !storageRules.includes('allow read, write: if false;')) {
        fail('Storage owner/deny invariant is missing');
    }
    if (databaseRules.rules['.read'] !== false || databaseRules.rules['.write'] !== false) {
        fail('RTDB deny-all invariant is missing');
    }
    console.log('  OK: payment bounds and deny-by-default rule invariants');
} catch (error) {
    fail(`critical invariant checks: ${error.message}`);
}

const ignoredDirectories = new Set(['.git', 'node_modules', '.vercel']);

function walkFiles(dir, extension) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
            files.push(...walkFiles(fullPath, extension));
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
            files.push(fullPath);
        }
    }
    return files;
}

console.log('Testing JavaScript syntax...');
const javaScriptFiles = walkFiles(root, '.js');
for (const file of javaScriptFiles) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        fail(`${path.relative(root, file)}\n${result.stderr.trim()}`);
    } else {
        console.log(`  OK: ${path.relative(root, file)}`);
    }
}
console.log(`  Checked ${javaScriptFiles.length} JavaScript files`);

console.log('Testing inline browser scripts...');
const htmlFiles = walkFiles(root, '.html');
const scriptPattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let inlineScriptCount = 0;
for (const file of htmlFiles) {
    const name = path.relative(root, file);
    const source = fs.readFileSync(file, 'utf8');
    let match;
    let scriptNumber = 0;
    while ((match = scriptPattern.exec(source))) {
        scriptNumber += 1;
        const script = match[1].trim();
        // Some pages embed JSON in a script tag; it is not JavaScript source.
        if (!script || script.startsWith('{')) continue;
        inlineScriptCount += 1;
        try {
            new vm.Script(script, { filename: `${name}:${scriptNumber}` });
        } catch (error) {
            fail(`${name}:${scriptNumber}: ${error.message}`);
        }
    }
}
console.log(`  Checked ${inlineScriptCount} inline scripts in ${htmlFiles.length} HTML files`);

const indexPath = path.join(root, 'index.html');
const indexSize = fs.statSync(indexPath).size;
if (indexSize < 100000) fail(`index.html is unexpectedly small (${indexSize} bytes)`);
else console.log(`  OK: index.html is ${indexSize} bytes`);

if (failures) {
    console.error(`=== Smoke test FAILED (${failures} issue${failures === 1 ? '' : 's'}) ===`);
    process.exitCode = 1;
} else {
    console.log('=== Smoke test complete ===');
}
