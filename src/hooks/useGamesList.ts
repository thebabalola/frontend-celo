"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { Address } from "viem";
import blocxtactoeAbiArtifact from "@/abi/blocxtactoeabi.json";
import { CONTRACT_ADDRESS } from "@/config/constants";

// Extract ABI array from Hardhat artifact
const blocxtactoeAbi = (blocxtactoeAbiArtifact as { abi: unknown[] }).abi;

export interface GameData {
  playerOne: Address;
  playerTwo: Address;
  betAmount: bigint;
  tokenAddress: Address;
  board: readonly number[];
  isPlayerOneTurn: boolean;
  winner: Address;
  lastMoveTimestamp: bigint;
  status: number; // 0=Active, 1=Ended, 2=Forfeited
}

export function useGamesList() {
  const [games, setGames] = useState<Map<bigint, GameData>>(new Map());
  const [loading, setLoading] = useState(true);

  // Get latest game ID
  const { data: latestGameId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "getLatestGameId",
  });

  useEffect(() => {
    if (!latestGameId) return;
    
    const loadGames = async () => {
      setLoading(true);
      const gameCount = Number(latestGameId);
      const gameMap = new Map<bigint, GameData>();
      
      // Load games in batches to avoid too many requests
      const batchSize = 10;
      for (let i = 0; i < gameCount; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, gameCount); j++) {
          batch.push(loadGame(BigInt(j)));
        }
        const results = await Promise.all(batch);
        results.forEach((game, index) => {
          if (game) {
            gameMap.set(BigInt(i + index), game);
          }
        });
      }
      
      setGames(gameMap);
      setLoading(false);
    };

    loadGames();
  }, [latestGameId]);

  return { games, loading, latestGameId };
}

async function loadGame(gameId: bigint): Promise<GameData | null> {
  try {
    const { createPublicClient, http } = await import("viem");
    // const { baseSepolia } = await import("wagmi/chains"); // Base Sepolia - commented out
    // const { base } = await import("wagmi/chains"); // Base Mainnet - commented out
    const { celo } = await import("wagmi/chains");
    
    const publicClient = createPublicClient({
      chain: celo,
      transport: http(),
    });

    const gameData = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: blocxtactoeAbi,
      functionName: "getGame",
      args: [gameId],
    }) as any;

    return gameData as GameData;
  } catch (error) {
    console.error(`Failed to load game ${gameId}:`, error);
    return null;
  }
}

