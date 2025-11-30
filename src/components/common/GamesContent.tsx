"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { GamesList, Game } from "@/components/games/GamesList";
import { GameModal } from "@/components/games/GameModal";
import { usePlayerChallenges, useChallengeData } from "@/hooks/useGameData";
import { Plus, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { createPublicClient, http, Address } from "viem";
// import { baseSepolia } from "wagmi/chains"; // Base Sepolia - commented out
// import { base } from "wagmi/chains"; // Base Mainnet - commented out
import { celo } from "wagmi/chains";
import blocxtactoeAbiArtifact from "@/abi/blocxtactoeabi.json";
import { CONTRACT_ADDRESS } from "@/config/constants";

// Extract ABI array from Hardhat artifact
const blocxtactoeAbi = (blocxtactoeAbiArtifact as { abi: unknown[] }).abi;
import { TabType } from "@/app/page";

interface GamesContentProps {
  onTabChange?: (tab: TabType) => void;
}

export function GamesContent({ onTabChange }: GamesContentProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState<bigint | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showActiveGames, setShowActiveGames] = useState(false);
  const [showPastGames, setShowPastGames] = useState(false);
  const [challengeGameIds, setChallengeGameIds] = useState<Set<string>>(new Set());
  const { isConnected, address } = useAccount();

  // Get latest game ID
  const { data: latestGameId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "getLatestGameId",
  });

  // Get player challenges to filter out challenge games
  const { challengeIds } = usePlayerChallenges(address as Address | undefined);

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

  // Load challenge game IDs to filter them out
  useEffect(() => {
    const loadChallengeGameIds = async () => {
      if (!challengeIds || !Array.isArray(challengeIds) || challengeIds.length === 0) {
        return;
      }

      try {
        const publicClient = createPublicClient({
          chain: celo,
          transport: http(),
        });

        const gameIdSet = new Set<string>();

        for (const challengeId of challengeIds) {
          try {
            const challengeData = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: blocxtactoeAbi,
              functionName: "getChallenge",
              args: [challengeId],
            }) as unknown[];

            // Challenge tuple order: challenger, challengerUsername, challenged, challengedUsername, 
            // betAmount, tokenAddress, boardSize, timestamp, accepted, gameId
            if (Array.isArray(challengeData) && challengeData.length >= 10) {
              const accepted = challengeData[8] as boolean;
              const gameId = challengeData[9] as bigint;
              
              if (accepted && gameId && gameId > BigInt(0)) {
                gameIdSet.add(gameId.toString());
              }
            }
          } catch (err) {
            console.error(`Failed to load challenge ${challengeId}:`, err);
          }
        }

        setChallengeGameIds(gameIdSet);
      } catch (error) {
        console.error("Failed to load challenge game IDs:", error);
      }
    };

    loadChallengeGameIds();
  }, [challengeIds]);

  useEffect(() => {
    if (latestGameId !== undefined) {
      loadGames();
    }
  }, [latestGameId, loadGames]);

  const handleGameClick = (gameId: bigint) => {
    setSelectedGameId(gameId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedGameId(null);
  };

  // Helper to check if a game is from a challenge (should be filtered out)
  const isNotChallengeGame = (game: Game) => {
    return !challengeGameIds.has(game.id);
  };

  // Filter out challenge games from all game lists
  const filteredGames = games.filter(isNotChallengeGame);

  return (
    <>
      <div className="px-2 sm:px-4 py-4 sm:py-6 md:px-8 md:py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-1 sm:mb-2">All Games</h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-400">Join existing games or create a new one</p>
            </div>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={loadGames}
                disabled={loading}
                className="flex items-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all border border-white/20 disabled:opacity-50 text-xs sm:text-sm"
              >
                <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={() => onTabChange?.("create")}
                className="flex items-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all border border-white/20 text-xs sm:text-sm flex-1 sm:flex-initial"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Create Game</span>
                <span className="sm:hidden">Create</span>
              </button>
            </div>
          </div>

          {loading && filteredGames.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          ) : (
            <>
              {/* Waiting Games (Always Visible) - excludes challenge games */}
              {filteredGames.filter(g => g.status === "waiting").length > 0 && (
                <GamesList 
                  games={filteredGames.filter(g => g.status === "waiting")} 
                  loading={loading} 
                  onGameClick={handleGameClick} 
                />
              )}
              
              {/* Active Games Section - Only show games where connected address is a participant, excludes challenge games */}
              {isConnected && address && filteredGames.filter(g => {
                if (g.status !== "active") return false;
                const player1Lower = g.player1.toLowerCase();
                const player2Lower = g.player2?.toLowerCase() || "";
                const addressLower = address.toLowerCase();
                return player1Lower === addressLower || player2Lower === addressLower;
              }).length > 0 && (
                <div className={filteredGames.filter(g => g.status === "waiting").length > 0 ? "mt-6 sm:mt-8" : ""}>
                  <button
                    onClick={() => setShowActiveGames(!showActiveGames)}
                    className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-4"
                  >
                    {showActiveGames ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                    <span className="text-lg sm:text-xl font-semibold">
                      My Active Games ({filteredGames.filter(g => {
                        if (g.status !== "active") return false;
                        const player1Lower = g.player1.toLowerCase();
                        const player2Lower = g.player2?.toLowerCase() || "";
                        const addressLower = address.toLowerCase();
                        return player1Lower === addressLower || player2Lower === addressLower;
                      }).length})
                    </span>
                  </button>
                  
                  {showActiveGames && (
                    <GamesList 
                      games={filteredGames.filter(g => {
                        if (g.status !== "active") return false;
                        const player1Lower = g.player1.toLowerCase();
                        const player2Lower = g.player2?.toLowerCase() || "";
                        const addressLower = address.toLowerCase();
                        return player1Lower === addressLower || player2Lower === addressLower;
                      })} 
                      loading={false} 
                      onGameClick={handleGameClick} 
                    />
                  )}
                </div>
              )}
              
              {/* Past Games Section - Only show games where connected address is a participant, excludes challenge games */}
              {isConnected && address && filteredGames.filter(g => {
                if (g.status !== "finished") return false;
                const player1Lower = g.player1.toLowerCase();
                const player2Lower = g.player2?.toLowerCase() || "";
                const addressLower = address.toLowerCase();
                return player1Lower === addressLower || player2Lower === addressLower;
              }).length > 0 && (
                <div className="mt-6 sm:mt-8">
                  <button
                    onClick={() => setShowPastGames(!showPastGames)}
                    className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-4"
                  >
                    {showPastGames ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                    <span className="text-lg sm:text-xl font-semibold">
                      My Past Games ({filteredGames.filter(g => {
                        if (g.status !== "finished") return false;
                        const player1Lower = g.player1.toLowerCase();
                        const player2Lower = g.player2?.toLowerCase() || "";
                        const addressLower = address.toLowerCase();
                        return player1Lower === addressLower || player2Lower === addressLower;
                      }).length})
                    </span>
                  </button>
                  
                  {showPastGames && (
                    <GamesList 
                      games={filteredGames.filter(g => {
                        if (g.status !== "finished") return false;
                        const player1Lower = g.player1.toLowerCase();
                        const player2Lower = g.player2?.toLowerCase() || "";
                        const addressLower = address.toLowerCase();
                        return player1Lower === addressLower || player2Lower === addressLower;
                      })} 
                      loading={false} 
                      onGameClick={handleGameClick} 
                    />
                  )}
                </div>
              )}
              
              {/* Show message if no games at all */}
              {filteredGames.filter(g => g.status === "waiting").length === 0 && 
               filteredGames.filter(g => g.status === "active").length === 0 && 
               filteredGames.filter(g => g.status === "finished").length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-300 text-lg mb-4">No games available</div>
                  <button
                    onClick={() => onTabChange?.("create")}
                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-medium transition-all border border-white/20"
                  >
                    Create New Game
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedGameId !== null && (
        <GameModal
          gameId={selectedGameId}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}

