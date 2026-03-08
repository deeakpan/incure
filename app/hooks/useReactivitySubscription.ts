'use client';

import { useEffect, useRef } from 'react';
import { createPublicClient, webSocket, decodeEventLog, keccak256, toHex } from 'viem';
import { SDK } from '@somnia-chain/reactivity';
import { useGameStore } from '../store/gameStore';
import { REGIONS } from '../utils/regionData';

const GAME_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` | undefined;
const SOMNIA_RPC_URL = process.env.NEXT_PUBLIC_SOMNIA_TESTNET_RPC_URL || 'https://api.infra.testnet.somnia.network';
const SOMNIA_WS_URL = process.env.NEXT_PUBLIC_SOMNIA_TESTNET_WS_URL || 'wss://api.infra.testnet.somnia.network/ws';

// Game contract ABI for event decoding
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
    inputs: [
      { name: 'newStrain', type: 'uint8', indexed: false },
    ],
  },
] as const;

// Helper to convert region ID to ISO code
function getIsoFromRegionId(regionId: number): string | null {
  const region = REGIONS[regionId as keyof typeof REGIONS];
  return region?.iso || null;
}

export function useReactivitySubscription() {
  const { updateInfection, setStrain } = useGameStore();
  const subscriptionRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    // Only subscribe if we have the game contract address
    if (!GAME_CONTRACT_ADDRESS) {
      console.warn('⚠️  Reactivity NOT started in UI. Missing NEXT_PUBLIC_GAME_CONTRACT_ADDRESS');
      return;
    }

    if (isSubscribedRef.current) {
      return;
    }

    console.log('🔮 [UI] Setting up Somnia Reactivity subscription...');
    console.log(`   Game Contract: ${GAME_CONTRACT_ADDRESS}`);
    console.log(`   RPC URL: ${SOMNIA_RPC_URL}`);
    console.log(`   WS URL: ${SOMNIA_WS_URL}`);

    // Create public client with WebSocket transport (required for Reactivity)
    const publicClient = createPublicClient({
      chain: {
        id: 50312,
        name: 'Somnia Testnet',
        nativeCurrency: {
          decimals: 18,
          name: 'Somnia Test Token',
          symbol: 'STT',
        },
        rpcUrls: {
          default: {
            http: [SOMNIA_RPC_URL],
            webSocket: [SOMNIA_WS_URL],
          },
        },
      },
      transport: webSocket(SOMNIA_WS_URL, {
        reconnect: {
          delay: 1000,
          attempts: Infinity,
        },
      }),
    });

    // Test WebSocket connection
    publicClient.getBlockNumber().then((blockNum) => {
      console.log(`✅ [UI] WebSocket connected! Current block: ${blockNum}`);
    }).catch((err) => {
      console.error('❌ [UI] WebSocket connection failed:', err.message);
    });

    // Initialize SDK
    const sdk = new SDK({
      public: publicClient,
    });

    // Calculate event topic hashes
    const antidoteDeployedTopic = keccak256(toHex('AntidoteDeployed(address,uint8,uint8,bool)'));
    const infectionSpreadTopic = keccak256(toHex('InfectionSpread(uint8[],uint8[])'));
    const pathogenMutatedTopic = keccak256(toHex('PathogenMutated(uint8)'));

    console.log(`   AntidoteDeployed topic: ${antidoteDeployedTopic}`);
    console.log(`   InfectionSpread topic: ${infectionSpreadTopic}`);
    console.log(`   PathogenMutated topic: ${pathogenMutatedTopic}`);

    // Subscribe to all game events
    sdk
      .subscribe({
        ethCalls: [], // No state reads needed, just events
        eventContractSources: [GAME_CONTRACT_ADDRESS],
        // Don't use topicOverrides - let Reactivity auto-detect events from contract
        onData: async (data) => {
          try {
            console.log('📨 [UI] Raw Reactivity event received:', data);
            console.log('   Data structure:', {
              hasResult: !!data.result,
              resultKeys: data.result ? Object.keys(data.result) : [],
            });
            
            // Handle different possible data structures
            const eventData = data.result || data;
            const eventTopic = eventData.topics?.[0];
            
            if (!eventTopic) {
              console.warn('⚠️ Received event with no topics:', eventData);
              return;
            }
            
            console.log('   Event topic:', eventTopic);

            // Decode AntidoteDeployed event
            if (eventTopic.toLowerCase() === antidoteDeployedTopic.toLowerCase()) {
              const decoded = decodeEventLog({
                abi: GAME_ABI,
                topics: eventData.topics,
                data: eventData.data,
              });

              if (decoded.eventName === 'AntidoteDeployed') {
                const { regionId, cureEffect, success, player } = decoded.args;
                const iso = getIsoFromRegionId(Number(regionId));

                console.log('📨 AntidoteDeployed event received:', {
                  player,
                  regionId: Number(regionId),
                  iso,
                  cureEffect: Number(cureEffect),
                  success,
                });

                // Read updated infection from contract
                try {
                  const newInfection = await publicClient.readContract({
                    address: GAME_CONTRACT_ADDRESS,
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

                  if (iso) {
                    updateInfection(iso, Number(newInfection));
                    console.log(`✅ Updated infection for ${iso}: ${Number(newInfection)}%`);
                  }
                } catch (error) {
                  console.error('Error reading infection from contract:', error);
                }
              }
            }
            // Decode InfectionSpread event
            else if (eventTopic.toLowerCase() === infectionSpreadTopic.toLowerCase()) {
              const decoded = decodeEventLog({
                abi: GAME_ABI,
                topics: eventData.topics,
                data: eventData.data,
              });

              if (decoded.eventName === 'InfectionSpread') {
                const { regionIds, newPcts } = decoded.args;
                console.log('📨 [UI] InfectionSpread event received:', {
                  regionIds: regionIds.map(Number),
                  newPcts: newPcts.map(Number),
                });

                // Update all affected regions in Zustand store
                regionIds.forEach((regionId, index) => {
                  const iso = getIsoFromRegionId(Number(regionId));
                  if (iso && newPcts[index] !== undefined) {
                    const pct = Number(newPcts[index]);
                    updateInfection(iso, pct);
                    console.log(`✅ [UI] Updated infection for ${iso} (region ${Number(regionId)}): ${pct}%`);
                  } else {
                    console.warn(`⚠️ [UI] Could not map region ${Number(regionId)} to ISO code`);
                  }
                });
                console.log(`✅ [UI] Updated ${regionIds.length} regions in store`);
              }
            }
            // Decode PathogenMutated event
            else if (eventTopic.toLowerCase() === pathogenMutatedTopic.toLowerCase()) {
              const decoded = decodeEventLog({
                abi: GAME_ABI,
                topics: eventData.topics,
                data: eventData.data,
              });

              if (decoded.eventName === 'PathogenMutated') {
                const { newStrain } = decoded.args;
                console.log('📨 PathogenMutated event received:', {
                  newStrain: Number(newStrain),
                });

                setStrain(Number(newStrain));
                console.log(`✅ Updated strain: ${Number(newStrain)}`);
              }
            }
          } catch (error) {
            console.error('⚠️ Error processing Reactivity event:', error);
          }
        },
        onError: (error) => {
          console.error('⚠️ Reactivity subscription error:', error);
        },
      })
      .then((subscription) => {
        if (subscription && 'unsubscribe' in subscription) {
          subscriptionRef.current = subscription;
          isSubscribedRef.current = true;
          console.log('✅ Reactivity subscription active');
          const subId = (subscription as any).subscriptionId;
          if (subId) {
            console.log(`   Subscription ID: ${subId}`);
          }
          console.log(`   Listening for events from: ${GAME_CONTRACT_ADDRESS}`);
          console.log('   Waiting for events...');
        } else {
          console.error('❌ Invalid subscription returned:', subscription);
          isSubscribedRef.current = false;
        }
      })
      .catch((error) => {
        console.error('❌ Failed to subscribe to Reactivity events:', error);
        isSubscribedRef.current = false;
      });

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        console.log('🛑 Unsubscribing from Reactivity events...');
        subscriptionRef.current
          .unsubscribe()
          .then(() => {
            console.log('✅ Unsubscribed from Reactivity');
          })
          .catch((error: unknown) => {
            console.error('⚠️ Error unsubscribing:', error);
          });
        subscriptionRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [updateInfection, setStrain]);

  return null; // This hook doesn't render anything
}
