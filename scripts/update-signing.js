#!/usr/bin/env node
// Signs update bundles with an Ed25519 key; the box checks the signature with node (see buzzerbox-update.sh).
//   node update-signing.js generate-key <private-key.pem> <public-key.pem>
//   node update-signing.js sign <private-key.pem> <file> <signature-file>
//   node update-signing.js verify <public-key.pem> <file> <signature-file>
// Keep the private key out of the repo. The public key belongs in install/.assets/update-public-key.pem.
const crypto = require('crypto');
const fs = require('fs');

const [command, ...args] = process.argv.slice(2);
if (command === 'generate-key' && args.length === 2) {
    const [privateKeyPath, publicKeyPath] = args;
    if (fs.existsSync(privateKeyPath)) {
        console.error(`${privateKeyPath} already exists, not overwriting it`);
        process.exit(1);
    }
    const {privateKey, publicKey} = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(privateKeyPath, privateKey.export({type: 'pkcs8', format: 'pem'}), {mode: 0o600});
    fs.writeFileSync(publicKeyPath, publicKey.export({type: 'spki', format: 'pem'}));
    console.log(`Wrote the private key to ${privateKeyPath} and the public key to ${publicKeyPath}`);
} else if (command === 'sign' && args.length === 3) {
    const [privateKeyPath, filePath, signaturePath] = args;
    const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath));
    fs.writeFileSync(signaturePath, crypto.sign(null, fs.readFileSync(filePath), privateKey));
} else if (command === 'verify' && args.length === 3) {
    const [publicKeyPath, filePath, signaturePath] = args;
    const publicKey = crypto.createPublicKey(fs.readFileSync(publicKeyPath));
    if (!crypto.verify(null, fs.readFileSync(filePath), publicKey, fs.readFileSync(signaturePath))) {
        console.error(`The signature of ${filePath} does not match ${publicKeyPath}`);
        process.exit(1);
    }
} else {
    console.error('Usage: node update-signing.js generate-key <private-key.pem> <public-key.pem>');
    console.error('       node update-signing.js sign <private-key.pem> <file> <signature-file>');
    console.error('       node update-signing.js verify <public-key.pem> <file> <signature-file>');
    process.exit(1);
}
