import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local manually or use command line args
let privateKey, expectedAddress = '0x68ac96Ce64D62386b1A5E2DFf8f0F01fEEd46E09';

// Try command line args first
if (process.argv[2]) {
  privateKey = process.argv[2];
  if (process.argv[3]) {
    expectedAddress = process.argv[3];
  }
} else {
  // Try reading .env
  try {
    const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
    const envVars = {};
    envFile.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) return;
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
    privateKey = envVars.TRUSTED_ORACLE_PRIVATE_KEY;
    if (envVars.TRUSTED_ORACLE_ADDRESS) {
      expectedAddress = envVars.TRUSTED_ORACLE_ADDRESS;
    }
  } catch (error) {
    // Fallback to environment variables
    privateKey = process.env.TRUSTED_ORACLE_PRIVATE_KEY;
    if (process.env.TRUSTED_ORACLE_ADDRESS) {
      expectedAddress = process.env.TRUSTED_ORACLE_ADDRESS;
    }
  }
}

if (!privateKey) {
  console.error('❌ TRUSTED_ORACLE_PRIVATE_KEY not found');
  console.error('Make sure it\'s set in .env or pass it as a command line argument');
  console.error('');
  console.error('Usage: node scripts/verify-oracle.mjs [PRIVATE_KEY] [EXPECTED_ADDRESS]');
  process.exit(1);
}

// Ensure private key has 0x prefix
const oracleKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

try {
  const account = privateKeyToAccount(oracleKey);
  const derivedAddress = account.address.toLowerCase();
  const expectedAddressLower = expectedAddress.toLowerCase();

  console.log('');
  console.log('🔍 Oracle Address Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Expected Address:', expectedAddress);
  console.log('Derived Address:', account.address);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (derivedAddress === expectedAddressLower) {
    console.log('✅ MATCH! Private key matches the expected address');
    console.log('');
    console.log('The signature verification should work correctly.');
  } else {
    console.log('❌ MISMATCH! Private key does NOT match the expected address');
    console.log('');
    console.log('The contract expects:', expectedAddress);
    console.log('But the private key derives:', account.address);
    console.log('');
    console.log('⚠️  This will cause signature verification to fail!');
    console.log('');
    console.log('Fix options:');
    console.log('1. Update TRUSTED_ORACLE_ADDRESS in the contract to:', account.address);
    console.log('2. Or use the private key that corresponds to:', expectedAddress);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}
