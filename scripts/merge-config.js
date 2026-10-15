#!/usr/bin/env node
// Merges an override file into a config file in place: node merge-config.js <config.json> <override.json>
// Used by the Docker builds to bake environment-specific settings (e.g. config.test.json) into config.json.
const fs = require('fs');

const [configPath, overridePath] = process.argv.slice(2);
if (!configPath || !overridePath) {
    console.error('Usage: node merge-config.js <config.json> <override.json>');
    process.exit(1);
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const merge = (target, source) => {
    for (const [key, value] of Object.entries(source)) {
        target[key] = isObject(value) && isObject(target[key]) ? merge(target[key], value) : value;
    }
    return target;
};

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const override = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
fs.writeFileSync(configPath, JSON.stringify(merge(config, override), null, 2) + '\n');
console.log(`Merged ${overridePath} into ${configPath}`);
