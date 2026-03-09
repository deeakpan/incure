import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, keccak256, encodePacked, hexToBytes, getAddress, createWalletClient, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Somnia Test Token',
    symbol: 'STT',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_SOMNIA_TESTNET_RPC_URL || 'https://api.infra.testnet.somnia.network'],
    },
  },
});
import { checkRateLimit } from './rateLimiter';

// Environment variables are read at runtime in the POST function

const GAME_ABI = [
  {
    name: 'formulaSeed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'currentStrain',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

// Secret formula derivation logic
// This is the "secret sauce" that determines what formula works for each region
function deriveFormula(formulaSeed: `0x${string}`, regionId: number, currentStrain: number): {
  targetChemIds: number[];
  targetRatios: number[];
} {
  // Derive a deterministic but unpredictable formula from the seed
  // Mix regionId and strain into the derivation for per-region variation
  const packed = encodePacked(
    ['bytes32', 'uint8', 'uint8'],
    [formulaSeed, regionId, currentStrain]
  );
  const hash = keccak256(packed);

  // Convert hash to bytes
  const hashBytes = hexToBytes(hash);
  
  // Select 3 unique chemical IDs from the hash
  const chemIds: number[] = [];
  let used = new Set<number>();
  for (let i = 0; i < 6 && chemIds.length < 3; i += 2) {
    const value = (hashBytes[i] % 15) + 1; // 1-15
    if (!used.has(value)) {
      chemIds.push(value);
      used.add(value);
    }
  }
  
  // If we didn't get 3 unique IDs, fill with defaults
  while (chemIds.length < 3) {
    let candidate = 1;
    while (used.has(candidate) && candidate <= 15) candidate++;
    if (candidate <= 15) {
      chemIds.push(candidate);
      used.add(candidate);
    } else {
      chemIds.push(chemIds.length + 1); // Fallback
    }
  }

  // Derive ratios from hash bytes (must sum to 100, each 5-90)
  const ratio1 = 5 + (hashBytes[6] % 86); // 5-90
  const ratio2 = 5 + (hashBytes[7] % 86);
  const remaining = 100 - ratio1 - ratio2;
  const ratio3 = Math.max(5, Math.min(90, remaining));

  // Normalize to ensure sum is exactly 100
  const ratios = [ratio1, ratio2, ratio3];
  const total = ratios.reduce((a, b) => a + b, 0);
  const diff = 100 - total;
  if (diff !== 0) {
    ratios[0] += diff;
  }

  return {
    targetChemIds: chemIds.slice(0, 3),
    targetRatios: ratios,
  };
}

// Score the player's submission against the target formula
function scoreFormula(
  playerChemIds: number[],
  playerRatios: number[],
  targetChemIds: number[],
  targetRatios: number[]
): { cureEffect: number; success: boolean } {
  // Check if chemicals match (order doesn't matter)
  const playerSet = new Set(playerChemIds);
  const targetSet = new Set(targetChemIds);
  
  const correctChemicals = [...playerSet].filter(id => targetSet.has(id)).length;
  
  if (correctChemicals === 0) {
    return { cureEffect: 0, success: false };
  }

  // Check ratios with 20% tolerance
  let ratioScore = 0;
  const TOLERANCE = 0.2; // 20%

  for (let i = 0; i < playerChemIds.length; i++) {
    const playerId = playerChemIds[i];
    const targetIndex = targetChemIds.indexOf(playerId);
    
    if (targetIndex !== -1) {
      const playerRatio = playerRatios[i];
      const targetRatio = targetRatios[targetIndex];
      const diff = Math.abs(playerRatio - targetRatio);
      const tolerance = targetRatio * TOLERANCE;
      
      if (diff <= tolerance) {
        ratioScore += 1;
      } else {
        // Partial credit for being close
        const closeness = Math.max(0, 1 - diff / (targetRatio * 2));
        ratioScore += closeness * 0.5;
      }
    }
  }

  // Calculate cure effect (0-100)
  const chemicalScore = correctChemicals / 3; // 0-1
  const ratioScoreNormalized = ratioScore / 3; // 0-1
  
  // Both chemicals and ratios must be correct for full score
  const combinedScore = (chemicalScore * 0.6) + (ratioScoreNormalized * 0.4);
  const cureEffect = Math.floor(combinedScore * 100);

  // Success if at least 2 chemicals match AND at least 2 ratios are within tolerance
  // OR if all 3 chemicals match (even if ratios are slightly off)
  const success = (correctChemicals >= 2 && ratioScore >= 2) || correctChemicals === 3;

  return { cureEffect, success };
}

export async function POST(request: NextRequest) {
  try {
    // Get env vars at runtime
    const gameAddress = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;
    let oracleKeyRaw = process.env.TRUSTED_ORACLE_PRIVATE_KEY;
    const rpcUrl = process.env.NEXT_PUBLIC_SOMNIA_TESTNET_RPC_URL || process.env.SOMNIA_TESTNET_RPC_URL || 'https://api.infra.testnet.somnia.network';

    // Ensure private key has 0x prefix
    let oracleKey: `0x${string}` | undefined;
    if (oracleKeyRaw) {
      oracleKey = oracleKeyRaw.startsWith('0x') 
        ? (oracleKeyRaw as `0x${string}`)
        : (`0x${oracleKeyRaw}` as `0x${string}`);
    }

    if (!gameAddress || !oracleKey) {
      console.error('Missing required env vars:', {
        gameAddress: !!gameAddress,
        oracleKey: !!oracleKey,
        rpcUrl: !!rpcUrl,
      });
      return NextResponse.json(
        { error: 'Server configuration missing. Check NEXT_PUBLIC_GAME_CONTRACT_ADDRESS and TRUSTED_ORACLE_PRIVATE_KEY environment variables.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { playerAddress, regionId, chemIds, ratios } = body;

    // Validate input
    if (!playerAddress || typeof regionId !== 'number' || !Array.isArray(chemIds) || !Array.isArray(ratios)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (chemIds.length !== 3 || ratios.length !== 3) {
      return NextResponse.json(
        { error: 'Must provide exactly 3 chemicals and ratios' },
        { status: 400 }
      );
    }

    if (ratios.reduce((a, b) => a + b, 0) !== 100) {
      return NextResponse.json(
        { error: 'Ratios must sum to 100' },
        { status: 400 }
      );
    }

    // Check rate limit (10 requests per hour per wallet)
    const rateLimit = checkRateLimit(playerAddress);
    if (!rateLimit.allowed) {
      const resetInMinutes = Math.ceil((rateLimit.resetAt - Date.now()) / (60 * 1000));
      return NextResponse.json(
        { 
          error: `Rate limit exceeded. Maximum 10 evaluations per hour. Try again in ${resetInMinutes} minute(s).`,
          rateLimit: {
            remaining: 0,
            resetAt: rateLimit.resetAt,
          }
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
            'Retry-After': resetInMinutes.toString(),
          }
        }
      );
    }

    // Validate contract address format
    if (!gameAddress.startsWith('0x') || gameAddress.length !== 42) {
      console.error('Invalid game address format:', gameAddress);
      return NextResponse.json(
        { error: 'Invalid game contract address format' },
        { status: 500 }
      );
    }

    // Fallback RPC URLs
    const fallbackRpcUrls = [
      rpcUrl,
      'https://api.infra.testnet.somnia.network',
    ].filter(Boolean) as string[];

    console.log('Attempting to read contract state:', {
      gameAddress,
      rpcUrls: fallbackRpcUrls,
      playerAddress,
      regionId,
    });

    // Try each RPC URL until one works
    let formulaSeed: `0x${string}` | undefined;
    let nonce: bigint | undefined;
    let currentStrain: number | undefined;
    let lastError: any = null;
    let successfulRpc: string | null = null;

    for (const rpc of fallbackRpcUrls) {
      try {
        console.log(`Trying RPC: ${rpc.substring(0, 50)}...`);
        const publicClient = createPublicClient({
          chain: somniaTestnet,
          transport: http(rpc, {
            timeout: 10000, // 10 second timeout
          }),
        });

        console.log('Calling readContract for formulaSeed, nonces, currentStrain...');
        // Get current state from contract
        const results = await Promise.all([
          publicClient.readContract({
            address: gameAddress,
            abi: GAME_ABI,
            functionName: 'formulaSeed',
          }) as Promise<`0x${string}`>,
          publicClient.readContract({
            address: gameAddress,
            abi: GAME_ABI,
            functionName: 'nonces',
            args: [getAddress(playerAddress)],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: gameAddress,
            abi: GAME_ABI,
            functionName: 'currentStrain',
          }) as Promise<number>,
        ]);
        
        formulaSeed = results[0];
        nonce = results[1];
        currentStrain = results[2];
        successfulRpc = rpc;
        
        console.log('Successfully fetched contract state:', {
          formulaSeed,
          nonce: nonce.toString(),
          currentStrain,
          rpc: rpc.substring(0, 50),
        });
        
        // Success - break out of loop
        break;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || error?.cause?.message || error?.toString() || JSON.stringify(error) || 'Unknown error';
        const errorDetails = {
          message: errorMessage,
          name: error?.name,
          code: error?.code,
          cause: error?.cause,
          shortMessage: error?.shortMessage,
          details: error?.details,
          stack: error?.stack,
        };
        console.error(`RPC ${rpc} failed:`, errorDetails);
        console.error('Full error object:', error);
        continue;
      }
    }

    if (!formulaSeed || nonce === undefined || currentStrain === undefined) {
      const errorMessage = lastError?.message || lastError?.cause?.message || lastError?.shortMessage || lastError?.toString() || (lastError ? JSON.stringify(lastError) : 'Unknown error') || 'Unknown error';
      const errorDetails: any = {
        error: lastError,
        message: errorMessage,
        name: lastError?.name,
        code: lastError?.code,
        cause: lastError?.cause,
        shortMessage: lastError?.shortMessage,
        details: lastError?.details,
        stack: lastError?.stack,
      };
      
      // Only try to stringify if lastError exists
      if (lastError) {
        try {
          errorDetails.stringified = JSON.stringify(lastError, Object.getOwnPropertyNames(lastError));
        } catch (stringifyError) {
          errorDetails.stringifyError = String(stringifyError);
        }
      }
      
      console.error('All RPC endpoints failed. Last error details:', errorDetails);
      return NextResponse.json(
        { error: `All RPC endpoints failed. Last error: ${errorMessage}. Check server logs for details.` },
        { status: 500 }
      );
    }

    // Derive today's formula for this region
    const target = deriveFormula(formulaSeed, regionId, currentStrain);

    // Score the player's submission
    const result = scoreFormula(chemIds, ratios, target.targetChemIds, target.targetRatios);

    // Debug logging
    console.log('Evaluation Debug:', {
      playerChemIds: chemIds,
      playerRatios: ratios,
      targetChemIds: target.targetChemIds,
      targetRatios: target.targetRatios,
      cureEffect: result.cureEffect,
      success: result.success,
    });

    // Create account for signing
    const account = privateKeyToAccount(oracleKey);

    // Create message: player, regionId, cureEffect, success, nonce
    // This must match the contract's keccak256(abi.encodePacked(...)) format
    const message = encodePacked(
      ['address', 'uint8', 'uint8', 'bool', 'uint256'],
      [getAddress(playerAddress), regionId, result.cureEffect, result.success, nonce]
    );

    // Hash the message (contract does keccak256)
    const messageHash = keccak256(message);
    
    // Sign with EIP-191 prefix
    // The contract uses MessageHashUtils.toEthSignedMessageHash(message), which does:
    // keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message))
    // We need to manually construct this and sign it
    const prefix = '\x19Ethereum Signed Message:\n32';
    const prefixedMessage = encodePacked(
      ['string', 'bytes32'],
      [prefix, messageHash]
    );
    const ethSignedMessageHash = keccak256(prefixedMessage);
    
    // Sign the raw hash - viem's signMessage with raw will sign without adding another prefix
    // Use the successful RPC URL, or fallback to env var or Alchemy
    if (!successfulRpc) {
      console.error('No successful RPC found, but contract state was fetched. This should not happen.');
      return NextResponse.json(
        { error: 'Internal error: RPC state inconsistent' },
        { status: 500 }
      );
    }
    
    const signingRpc = successfulRpc;
    console.log('Signing message with RPC:', signingRpc.substring(0, 50));
    
    try {
      const walletClient = createWalletClient({
        account,
        chain: somniaTestnet,
        transport: http(signingRpc, {
          timeout: 10000, // 10 second timeout
        }),
      });
      
      // Sign the hash directly - the hash is already prefixed with EIP-191
      // viem's signMessage with raw should sign the hash directly without adding another prefix
      console.log('Signing message hash:', ethSignedMessageHash);
      console.log('Account address:', account.address);
      console.log('Hash length:', ethSignedMessageHash.length, '(should be 66 for 0x + 64 hex chars)');
      
      // Verify hash format
      if (!ethSignedMessageHash.startsWith('0x') || ethSignedMessageHash.length !== 66) {
        throw new Error(`Invalid hash format: ${ethSignedMessageHash} (length: ${ethSignedMessageHash.length})`);
      }
      
      // IMPORTANT: We need to sign the hash directly without any prefix
      // The hash is already prefixed with EIP-191, so we sign it as-is
      // Use account.sign() to sign the hash directly without any EIP-191 prefix
      // This matches what the contract expects: signature of the EIP-191 prefixed hash
      const signature = await account.sign({
        hash: ethSignedMessageHash as `0x${string}`,
      });
      
      console.log('Signature generated successfully');
      console.log('Signature:', signature);
      console.log('Signature length:', signature.length, 'chars (should be 132 = 0x + 130 hex for 65 bytes)');
      
      // Verify signature format (should be 65 bytes = 130 hex chars + 0x = 132 chars)
      if (signature.length !== 132) {
        console.warn(`Warning: Signature length is ${signature.length}, expected 132`);
      }

      return NextResponse.json({
        cureEffect: result.cureEffect,
        success: result.success,
        signature,
        nonce: nonce.toString(),
      }, {
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        }
      });
    } catch (signingError: any) {
      console.error('Signing error:', signingError);
      console.error('Signing error details:', {
        message: signingError?.message,
        name: signingError?.name,
        code: signingError?.code,
        cause: signingError?.cause,
        stack: signingError?.stack,
      });
      return NextResponse.json(
        { error: `Failed to sign message: ${signingError?.message || 'Unknown signing error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Evaluation error:', error);
    console.error('Error details:', {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      cause: error?.cause,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: error?.message || 'Evaluation failed' },
      { status: 500 }
    );
  }
}
