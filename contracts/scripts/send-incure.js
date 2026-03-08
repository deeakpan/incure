require('dotenv').config();
const { ethers } = require("ethers");

async function main() {
  // Load private key from .env
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ Error: PRIVATE_KEY not found in .env');
    console.log('   Add PRIVATE_KEY=... to contracts/.env');
    process.exit(1);
  }
  
  // Ensure private key starts with 0x
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  // Get the token address from .env or use a default
  const tokenAddress = process.env.INCURE_TOKEN_ADDRESS;
  if (!tokenAddress) {
    console.error('❌ Error: INCURE_TOKEN_ADDRESS not found in .env');
    console.log('   Add INCURE_TOKEN_ADDRESS=... to contracts/.env');
    process.exit(1);
  }

  // Connect to Somnia Testnet
  const rpcUrl = process.env.SOMNIA_TESTNET_RPC_URL || 'https://dream-rpc.somnia.network';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Recipient address
  const recipientAddress = '0x68ac96Ce64D62386b1A5E2DFf8f0F01fEEd46E09';
  
  // Amount to send (5000 tokens with 18 decimals)
  const amount = ethers.parseEther('5000');

  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('📤 Sending INCURE tokens...');
  console.log('   Network: Somnia Testnet');
  console.log('   RPC:', rpcUrl);
  console.log('   From:', wallet.address);
  console.log('   To:', recipientAddress);
  console.log('   Amount: 5000 INCURE');
  
  // Check network connection
  const network = await provider.getNetwork();
  console.log('   Chain ID:', network.chainId.toString());

  // Get token contract
  const tokenAbi = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
  ];
  
  const token = new ethers.Contract(tokenAddress, tokenAbi, wallet);

  // Check balance before transfer
  const balance = await token.balanceOf(wallet.address);
  console.log('   Sender balance:', ethers.formatEther(balance), 'INCURE');

  if (balance < amount) {
    console.error('❌ Error: Insufficient balance');
    console.log('   Required:', ethers.formatEther(amount), 'INCURE');
    console.log('   Available:', ethers.formatEther(balance), 'INCURE');
    process.exit(1);
  }

  // Send transaction
  console.log('\n⏳ Sending transaction...');
  const tx = await token.transfer(recipientAddress, amount);
  console.log('   Transaction hash:', tx.hash);
  
  // Wait for confirmation
  console.log('⏳ Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
  
  // Check recipient balance
  const recipientBalance = await token.balanceOf(recipientAddress);
  console.log('\n✅ Transfer complete!');
  console.log('   Recipient balance:', ethers.formatEther(recipientBalance), 'INCURE');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
