import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Get from environment
const privateKey = process.env.TRUSTED_ORACLE_PRIVATE_KEY;
const expectedAddress = process.env.TRUSTED_ORACLE_ADDRESS || '0x68ac96Ce64D62386b1A5E2DFf8f0F01fEEd46E09';

if (!privateKey) {
  console.error('❌ TRUSTED_ORACLE_PRIVATE_KEY not found in environment');
  process.exit(1);
}

// Ensure private key has 0x prefix
const oracleKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

try {
  const account = privateKeyToAccount(oracleKey);
  const derivedAddress = account.address.toLowerCase();
  const expectedAddressLower = expectedAddress.toLowerCase();

  console.log('🔍 Oracle Address Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Expected Address:', expectedAddress);
  console.log('Derived Address:', account.address);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (derivedAddress === expectedAddressLower) {
    console.log('✅ MATCH! Private key matches the expected address');
  } else {
    console.log('❌ MISMATCH! Private key does NOT match the expected address');
    console.log('');
    console.log('The contract expects:', expectedAddress);
    console.log('But the private key derives:', account.address);
    console.log('');
    console.log('⚠️  This will cause signature verification to fail!');
    console.log('Fix: Update TRUSTED_ORACLE_ADDRESS in the contract or use the correct private key');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}
