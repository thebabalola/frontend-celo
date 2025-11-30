"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { GamesList, Game } from "@/components/games/GamesList";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { createPublicClient, http } from "viem";
// import { baseSepolia } from "wagmi/chains"; // Base Sepolia - commented out
// import { base } from "wagmi/chains"; // Base Mainnet - commented out
import { celo } from "wagmi/chains";
import blocxtactoeAbiArtifact from "@/abi/blocxtactoeabi.json";
import { CONTRACT_ADDRESS } from "@/config/constants";

// Extract ABI array from Hardhat artifact
const blocxtactoeAbi = (blocxtactoeAbiArtifact as { abi: unknown[] }).abi;

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const { isConnected } = useAccount();
  const router = useRouter();

  // Get latest game ID
  const { data: latestGameId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "getLatestGameId",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadGameData = useCallback(async (gameId: bigint, publicClient: any, retries = 3): Promise<Game | null> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const gameData = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: blocxtactoeAbi,
          functionName: "getGame",
          args: [gameId],
        }) as {
          playerOne: string;
          playerTwo: string;
          betAmount: bigint;
          status: number;
          winner: string;
          isPlayerOneTurn: boolean;
          boardSize: number;
        };

        if (!gameData) return null;

        const { playerOne, playerTwo, betAmount, status, winner, isPlayerOneTurn, boardSize } = gameData;
        
        let gameStatus: "waiting" | "active" | "finished" = "waiting";
        if (status === 1) { // Ended
          gameStatus = "finished";
        } else if (status === 2) { // Forfeited
          gameStatus = "finished";
        } else if (playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000") {
          gameStatus = "active";
        }

        // Get time remaining for active games
        let timeRemaining: bigint | null = null;
        let canForfeit = false;
        if (gameStatus === "active") {
          try {
            timeRemaining = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: blocxtactoeAbi,
              functionName: "getTimeRemaining",
              args: [gameId],
            }) as bigint;
            canForfeit = timeRemaining === BigInt(0);
          } catch {
            // Game might be finished or invalid
          }
        }

        return {
          id: gameId.toString(),
          gameId,
          player1: playerOne as string,
          player2: playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000" ? (playerTwo as string) : null,
          betAmount: betAmount as bigint,
          status: gameStatus,
          currentPlayer: isPlayerOneTurn ? (playerOne as string) : (playerTwo as string),
          winner: winner && winner !== "0x0000000000000000000000000000000000000000" ? (winner as string) : null,
          createdAt: new Date(),
          timeRemaining,
          canForfeit,
          boardSize: boardSize ? Number(boardSize) : 3,
        } as Game;
      } catch (error) {
        // If this is the last attempt, return null
        if (attempt === retries - 1) {
          console.error(`Failed to load game ${gameId} after ${retries} attempts:`, error);
          return null;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
    return null;
  }, []);

  const loadGames = useCallback(async () => {
    if (!latestGameId) return;
    
    setLoading(true);
    try {
      const publicClient = createPublicClient({
        chain: celo,
        transport: http(),
      });

      const gameCount = Number(latestGameId);
      const allGames: Game[] = [];
      const batchSize = 5; // Load 5 games at a time to avoid rate limiting
      
      // Load games in batches
      for (let i = 0; i < gameCount; i += batchSize) {
        const batchPromises: Promise<Game | null>[] = [];
        const batchEnd = Math.min(i + batchSize, gameCount);
        
        for (let j = i; j < batchEnd; j++) {
          batchPromises.push(loadGameData(BigInt(j), publicClient));
        }
        
        // Use Promise.allSettled to handle partial failures
        const results = await Promise.allSettled(batchPromises);
        
        for (const result of results) {
          if (result.status === "fulfilled" && result.value !== null) {
            allGames.push(result.value);
          }
        }
        
        // Small delay between batches to avoid rate limiting
        if (batchEnd < gameCount) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      setGames(allGames);
    } catch (error) {
      console.error("Failed to load games:", error);
    } finally {
      setLoading(false);
    }
  }, [latestGameId, loadGameData]);

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
      return;
    }
    if (latestGameId !== undefined) {
      loadGames();
    }
  }, [isConnected, router, latestGameId, loadGames]);

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">All Games</h1>
            <p className="text-gray-400">Join existing games or create a new one</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadGames}
              disabled={loading}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-all border border-white/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/create"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-all border border-white/20"
            >
              <Plus className="w-4 h-4" />
              Create Game
            </Link>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Connect Wallet", desc: "Link your Web3 wallet" },
              { step: "2", title: "Create or Join", desc: "Start a game or join existing one" },
              { step: "3", title: "Place Bet", desc: "Set your bet amount in ETH" },
              { step: "4", title: "Play & Win", desc: "Make moves and claim victory" },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-white/20 transition-all"
              >
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white border border-white/20">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-300 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {loading && games.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        ) : (
          <GamesList games={games} loading={loading} />
        )}
      </div>
    </div>
  );
}
