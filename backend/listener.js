import { updateRegionInfection, batchUpdateInfection, updateLeaderboard } from './db.js';
import { broadcast } from './ws.js';
import { SDK } from '@somnia-chain/reactivity';
import { createPublicClient, defineChain, webSocket, decodeEventLog, keccak256, toHex } from 'viem';

const GAME_ABI = [
  {
    type: 'event',
    name: 'AntidoteDeployed',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'regionId', type: 'uint8', indexed: false },
      { name: 'cureEffect', type: 'uint8', indexed: false },
      { name: 'success', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'InfectionSpread',
    inputs: [
      { name: 'regionIds', type: 'uint8[]', indexed: false },
      { name: 'newPcts', type: 'uint8[]', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PathogenMutated',
    inputs: [{ name: 'newStrain', type: 'uint8', indexed: false }],
  },
];

// Somnia Testnet chain config for viem
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
      http: [process.env.SOMNIA_TESTNET_RPC_URL || 'https://api.infra.testnet.somnia.network'],
      webSocket: [
        (process.env.SOMNIA_TESTNET_WS_URL ||
          'wss://api.infra.testnet.somnia.network/ws'),
      ],
    },
  },
});

export function startListener(gameAddress) {
  const wsUrl =
    process.env.SOMNIA_TESTNET_WS_URL || 'wss://api.infra.testnet.somnia.network/ws';

  console.log('Starting Somnia Reactivity listener for:', gameAddress);
  console.log('WS URL:', wsUrl);

  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: webSocket(wsUrl, {
      reconnect: {
        delay: 1000,
        attempts: Infinity,
      },
    }),
  });

  // Test WebSocket connection
  publicClient.getBlockNumber().then((blockNum) => {
    console.log('✅ WebSocket connected! Current block:', blockNum);
  }).catch((err) => {
    console.error('❌ WebSocket connection failed:', err.message);
  });

  const sdk = new SDK({
    public: publicClient,
  });

  // Store gameAddress and publicClient for use in callbacks
  const gameContractAddress = gameAddress;

  const antidoteTopic = keccak256(
    toHex('AntidoteDeployed(address,uint8,uint8,bool)')
  );
  const spreadTopic = keccak256(
    toHex('InfectionSpread(uint8[],uint8[])')
  );
  const mutationTopic = keccak256(
    toHex('PathogenMutated(uint8)')
  );

  console.log('Event topics:');
  console.log('  AntidoteDeployed:', antidoteTopic);
  console.log('  InfectionSpread:', spreadTopic);
  console.log('  PathogenMutated:', mutationTopic);
  console.log('Subscribing to events from:', gameAddress);

  sdk
    .subscribe({
      ethCalls: [],
      eventContractSources: [gameAddress],
      // Don't use topicOverrides - let Reactivity auto-detect events from contract
      onData: async (data) => {
        try {
          console.log('📨 Raw Reactivity data received:', JSON.stringify(data, null, 2));
          console.log('   Data structure:', {
            hasResult: !!data.result,
            resultKeys: data.result ? Object.keys(data.result) : [],
            fullData: data,
          });
          
          // Handle different possible data structures
          const eventData = data.result || data;
          const { topics, data: logData } = eventData;
          
          if (!topics || !logData) {
            console.warn('⚠️ Event data missing topics or logData:', eventData);
            return;
          }
          
          const topic0 = topics[0];

          const decoded = decodeEventLog({
            abi: GAME_ABI,
            topics,
            data: logData,
          });

          switch (decoded.eventName) {
            case 'AntidoteDeployed': {
              // PRIMARY USE CASE: Users deploy antidotes via deployAntidote()
              // This is the main event we're subscribing for - real-time updates when players cure regions
              const { player, regionId, cureEffect, success } = decoded.args;
              console.log('📨 AntidoteDeployed event received (user action):', {
                player,
                regionId: Number(regionId),
                cureEffect: Number(cureEffect),
                success,
              });

              const region = Number(regionId);
              const effect = Number(cureEffect);

              try {
                // Read updated infection from contract (cureEffect is reduction, not new infection %)
                const newInfection = await publicClient.readContract({
                  address: gameContractAddress,
                  abi: [
                    {
                      type: 'function',
                      name: 'regionInfection',
                      inputs: [{ name: 'regionId', type: 'uint8' }],
                      outputs: [{ name: '', type: 'uint8' }],
                      stateMutability: 'view',
                    },
                  ],
                  functionName: 'regionInfection',
                  args: [regionId],
                });

                const infectionPct = Number(newInfection);
                console.log(`   Updated infection for region ${region}: ${infectionPct}%`);

                // Update database with actual infection percentage
                await updateRegionInfection(region, infectionPct);

                // Broadcast to all clients
                broadcast({
                  type: 'infection_update',
                  regionId: region,
                  newPct: infectionPct,
                  player,
                  cureEffect: effect,
                  success: Boolean(success),
                });

                if (success) {
                  const reward = (effect * 100) / 100;
                  await updateLeaderboard(player, reward);
                }
              } catch (error) {
                console.error('Error handling AntidoteDeployed:', error);
              }
              break;
            }
            case 'InfectionSpread': {
              // Note: Backend cron triggers spread every 5 minutes and handles it directly from receipt.
              // This subscription handler serves as a fallback/redundancy in case the cron job fails.
              // The PRIMARY use case for subscriptions is AntidoteDeployed events (when users deploy antidotes).
              const { regionIds, newPcts } = decoded.args;
              console.log('📨 InfectionSpread event received (via subscription):', { 
                regionIds: regionIds.map(Number), 
                newPcts: newPcts.map(Number) 
              });

              try {
                const updates = regionIds.map((id, i) => ({
                  regionId: Number(id),
                  pct: Number(newPcts[i]),
                }));

                console.log(`   Updating ${updates.length} regions in Supabase...`);
                await batchUpdateInfection(updates);
                console.log('✅ Supabase updated successfully');

                broadcast({
                  type: 'spread',
                  updates,
                });
                console.log('✅ Broadcasted to WebSocket clients');
              } catch (error) {
                console.error('❌ Error handling InfectionSpread:', error);
              }
              break;
            }
            case 'PathogenMutated': {
              const { newStrain } = decoded.args;
              console.log('PathogenMutated:', { newStrain });

              broadcast({
                type: 'mutation',
                newStrain: Number(newStrain),
              });
              break;
            }
            default:
              console.log('Unhandled event:', decoded.eventName);
          }
        } catch (error) {
          console.error('Error in reactivity onData handler:', error);
        }
      },
      onError: (error) => {
        // Only log connection errors occasionally to reduce noise
        const errorMsg = error?.message || error?.shortMessage || String(error);
        if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout') || errorMsg.includes('closed')) {
          // Suppress frequent timeout/connection errors - they'll retry automatically
          return;
        }
        console.error('Somnia Reactivity subscription error:', errorMsg);
      },
    })
    .then((subscription) => {
      console.log(
        '✅ Somnia Reactivity subscription started. ID:',
        subscription.subscriptionId
      );
      console.log('   Listening for events from contract:', gameAddress);
      console.log('   Waiting for events...');
    })
    .catch((error) => {
      console.error('Failed to start Somnia Reactivity subscription:', error);
    });
}
