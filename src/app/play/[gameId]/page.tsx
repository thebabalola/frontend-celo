"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { GameBoard, BoardState, CellValue } from "@/components/games/GameBoard";
import { CountdownTimer } from "@/components/games/CountdownTimer";
import { ForfeitModal } from "@/components/games/ForfeitModal";
import { JoinGameModal } from "@/components/games/JoinGameModal";
import { useBlOcXTacToe } from "@/hooks/useBlOcXTacToe";
import { useGameData } from "@/hooks/useGameData";
import { formatEther } from "viem";
import { Loader2, Coins, Users, AlertCircle, ArrowLeft, Clock, Trophy } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import blocxtactoeAbiArtifact from "@/abi/blocxtactoeabi.json";
import { CONTRACT_ADDRESS } from "@/config/constants";

// Extract ABI array from Hardhat artifact
const blocxtactoeAbi = (blocxtactoeAbiArtifact as { abi: unknown[] }).abi;

type GameStatus = "waiting" | "active" | "finished";

export default function PlayGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = BigInt(params.gameId as string);
  const { address, isConnected } = useAccount();
  const { play, joinGame, forfeitGame, claimReward, isPending, isConfirming, isConfirmed } = useBlOcXTacToe();
  const queryClient = useQueryClient();

  // Get game data using hook
  const { game, timeRemaining } = useGameData(gameId);

  // Get claimable reward info
  const { data: claimableReward } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "claimableRewards",
    args: [gameId],
  });
  
  const { data: rewardClaimed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "rewardClaimed",
    args: [gameId],
  });

  const [board, setBoard] = useState<BoardState>(Array(9).fill(null));
  const [gameStatus, setGameStatus] = useState<GameStatus>("waiting");
  const [canJoin, setCanJoin] = useState(false);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [loadingGame, setLoadingGame] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [winningCells, setWinningCells] = useState<number[]>([]);
  const [canForfeit, setCanForfeit] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [selectedJoinMove, setSelectedJoinMove] = useState<number | null>(null);
  const [showJoinConfirmModal, setShowJoinConfirmModal] = useState(false);
  const [boardSize, setBoardSize] = useState<number>(3);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch board data from gameBoards mapping using multicall to batch all reads
  const fetchBoardData = useCallback(async () => {
    if (!game || typeof game !== "object" || !("boardSize" in game)) return;
    
    const size = (game as { boardSize: number }).boardSize || 3;
    setBoardSize(size);
    const maxCells = size * size;
    
    try {
      const { createPublicClient, http } = await import("viem");
      const { celo } = await import("wagmi/chains");
      
      const publicClient = createPublicClient({
        chain: celo,
        transport: http(),
      });

      // Use multicall to batch all board cell reads into a single request
      const multicallResults = await publicClient.multicall({
        contracts: Array.from({ length: maxCells }, (_, i) => ({
          address: CONTRACT_ADDRESS,
          abi: blocxtactoeAbi,
          functionName: "gameBoards",
          args: [gameId, BigInt(i)],
        })),
      });
      
      // Convert to UI format
      const uiBoard: BoardState = multicallResults.map((result) => {
        if (result.status === "failure") {
          console.error("Failed to fetch board cell:", result.error);
          return null;
        }
        const cellValue = typeof result.result === "bigint" ? Number(result.result) : Number(result.result);
        if (cellValue === 0) return null;
        return cellValue === 1 ? "X" : "O";
      });
      
      setBoard(uiBoard);
    } catch (err: any) {
      console.error("Error fetching board data:", err);
      // If rate limited, don't update board to avoid spam
      if (err?.status === 429 || err?.code === -32016) {
        console.warn("Rate limited - skipping board update");
        return;
      }
      // Set empty board as fallback for other errors
      setBoard(Array(maxCells).fill(null));
    }
  }, [game, gameId]);

  const updateGameState = useCallback(() => {
    if (!game || !address || typeof game !== "object") return;
    if (!("playerOne" in game)) return;

    setLoadingGame(false);
    
    const { playerOne, playerTwo, betAmount, status, winner, isPlayerOneTurn, boardSize: gameBoardSize } = game as {
      playerOne: string;
      playerTwo: string | null;
      betAmount: bigint;
      status: number;
      winner: string | null;
      isPlayerOneTurn: boolean;
      boardSize: number;
    };

    // Set board size and initialize board if needed
    if (gameBoardSize) {
      setBoardSize(gameBoardSize);
      const maxCells = gameBoardSize * gameBoardSize;
      // Initialize board with correct size (will be populated by fetchBoardData)
      setBoard((prevBoard) => {
        if (prevBoard.length !== maxCells) {
          return Array(maxCells).fill(null);
        }
        return prevBoard;
      });
    }

    // Determine game status
    let statusEnum: GameStatus = "waiting";
    if (status === 1) { // Ended
      statusEnum = "finished";
    } else if (status === 2) { // Forfeited
      statusEnum = "finished";
    } else if (playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000") {
      statusEnum = "active";
    }
    setGameStatus(statusEnum);

    // Check if player can join
    if (statusEnum === "waiting" && address.toLowerCase() !== playerOne.toLowerCase()) {
      setCanJoin(true);
    } else {
      setCanJoin(false);
    }

    // Check if it's player's turn
    if (statusEnum === "active" && playerTwo) {
      const currentPlayer = isPlayerOneTurn ? playerOne : playerTwo;
      setIsPlayerTurn(address.toLowerCase() === currentPlayer.toLowerCase());
    } else {
      setIsPlayerTurn(false);
    }

    // Check for winner and winning cells
    if (winner && winner !== "0x0000000000000000000000000000000000000000") {
      // Find winning cells (simplified - in production, calculate from board)
      setWinningCells([]);
    }
  }, [game, address]);

  // Update game state when game data changes
  useEffect(() => {
    if (!isConnected) {
      router.push("/");
      return;
    }
    if (game) {
      updateGameState();
    }
  }, [game, isConnected, router, address, updateGameState]);

  // Fetch board data when game changes
  useEffect(() => {
    if (game && typeof game === "object" && "playerOne" in game && "boardSize" in game) {
      fetchBoardData();
    }
  }, [fetchBoardData, game]);

  // Refresh board after transaction confirmation
  useEffect(() => {
    if (isConfirmed) {
      // Refetch game data and board
      queryClient.invalidateQueries({ queryKey: ["readContract", "getGame", gameId] });
      setTimeout(() => {
        fetchBoardData();
      }, 1000); // Wait 1 second for block confirmation
    }
  }, [isConfirmed, queryClient, gameId, fetchBoardData]);

  // Poll for board updates during active games (increased interval to reduce rate limits)
  useEffect(() => {
    if (gameStatus === "active" && !isPlayerTurn) {
      // Poll every 5 seconds when waiting for opponent (reduced frequency to avoid rate limits)
      pollingIntervalRef.current = setInterval(() => {
        fetchBoardData();
        queryClient.invalidateQueries({ queryKey: ["readContract", "getGame", gameId] });
      }, 5000);
    } else {
      // Clear polling when it's player's turn or game is finished
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [gameStatus, isPlayerTurn, fetchBoardData, queryClient, gameId]);

  useEffect(() => {
    if (timeRemaining !== undefined) {
      setCanForfeit(timeRemaining === BigInt(0));
    }
  }, [timeRemaining]);

  const handleCellClick = async (index: number) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    if (gameStatus === "waiting" && canJoin) {
      // Join game - first select move, then show confirmation
      if (selectedJoinMove === null) {
        setSelectedJoinMove(index);
        return;
      }
      // Show confirmation modal
      setShowJoinConfirmModal(true);
    } else if (gameStatus === "active" && isPlayerTurn) {
      // Make a move
      if (board[index] !== null) {
        toast.error("Cell is already occupied");
        return;
      }
      try {
        await play(gameId, index);
        toast.success("Move submitted...");
      } catch (err: any) {
        toast.error(err?.message || "Failed to make move");
      }
    }
  };

  const handleForfeit = async () => {
    try {
      await forfeitGame(gameId);
      setShowForfeitModal(false);
      toast.success("Forfeit transaction submitted...");
    } catch (err: any) {
      toast.error(err?.message || "Failed to forfeit game");
    }
  };

  const handleClaimReward = async () => {
    if (rewardClaimed) {
      toast.error("Reward already claimed");
      return;
    }
    try {
      await claimReward(gameId);
      toast.success("Reward claimed successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to claim reward");
    }
  };

  const handleConfirmJoin = async () => {
    if (selectedJoinMove === null) {
      toast.error("Please select a move");
      return;
    }
    try {
      setShowJoinConfirmModal(false);
      await joinGame(gameId, selectedJoinMove);
      setSelectedJoinMove(null);
      toast.success("Joining game...");
    } catch (err: any) {
      toast.error(err?.message || "Failed to join game");
      setSelectedJoinMove(null);
    }
  };

  if (loadingGame || !game || typeof game !== "object" || !("playerOne" in game)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-white animate-spin" />
      </div>
    );
  }
  const { playerOne, playerTwo, betAmount, winner } = game as {
    playerOne: string;
    playerTwo: string | null;
    betAmount: bigint;
    winner: string | null;
  };
  const isPlayer1 = address?.toLowerCase() === playerOne.toLowerCase();
  const isPlayer2 = playerTwo && address?.toLowerCase() === playerTwo.toLowerCase();

  return (
    <div className="min-h-screen px-2 sm:px-4 py-4 sm:py-6 md:px-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/games"
          className="inline-flex items-center gap-1.5 sm:gap-2 text-gray-400 hover:text-white mb-4 sm:mb-6 transition-colors text-xs sm:text-sm"
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
          <span>Back to Games</span>
        </Link>

        <div className="bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-4 md:p-6 lg:p-8">
          {/* Game Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
            <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 border border-white/10">
              <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 mb-0.5 sm:mb-1">
                <Coins className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">
                  {playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000" ? "Bet Total" : "Bet Amount"}
                </span>
              </div>
              <p className="text-white font-semibold text-sm sm:text-base md:text-lg">
                {playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000" 
                  ? formatEther((betAmount || BigInt(0)) * BigInt(2)) + " ETH"
                  : formatEther(betAmount || BigInt(0)) + " ETH"}
              </p>
                </div>
            <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 border border-white/10">
              <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 mb-0.5 sm:mb-1">
                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Players</span>
              </div>
              <p className="text-white font-semibold text-sm sm:text-base">
                {playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000" ? "2/2" : "1/2"}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 border border-white/10">
              <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 mb-0.5 sm:mb-1">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Time Remaining</span>
              </div>
              {timeRemaining !== undefined && typeof timeRemaining === "bigint" && (
                <CountdownTimer timeRemaining={timeRemaining} />
              )}
            </div>
                  </div>

          {/* Player Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
            <div className={`p-2 sm:p-3 md:p-4 rounded-lg border ${isPlayer1 ? "bg-white/10 border-white/30" : "bg-white/5 border-white/10"}`}>
              <p className="text-xs sm:text-sm text-gray-400 mb-0.5 sm:mb-1">Player 1 (X)</p>
              <p className="text-white font-mono text-xs sm:text-sm truncate">{playerOne.slice(0, 6)}...{playerOne.slice(-4)}</p>
              {isPlayer1 && <span className="text-[10px] sm:text-xs text-green-400 mt-0.5 sm:mt-1 block">You</span>}
                  </div>
            {playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000" ? (
              <div className={`p-2 sm:p-3 md:p-4 rounded-lg border ${isPlayer2 ? "bg-white/10 border-white/30" : "bg-white/5 border-white/10"}`}>
                <p className="text-xs sm:text-sm text-gray-400 mb-0.5 sm:mb-1">Player 2 (O)</p>
                <p className="text-white font-mono text-xs sm:text-sm truncate">{playerTwo.slice(0, 6)}...{playerTwo.slice(-4)}</p>
                {isPlayer2 && <span className="text-[10px] sm:text-xs text-green-400 mt-0.5 sm:mt-1 block">You</span>}
                  </div>
                ) : (
              <div className="p-2 sm:p-3 md:p-4 rounded-lg border border-white/10 bg-white/5">
                <p className="text-xs sm:text-sm text-gray-400 mb-0.5 sm:mb-1">Player 2 (O)</p>
                <p className="text-gray-500 text-xs sm:text-sm">Waiting for player...</p>
              </div>
            )}
          </div>

          {/* Game Status - Winner */}
          {gameStatus === "finished" && winner && winner !== "0x0000000000000000000000000000000000000000" && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                <p className="text-green-400 font-semibold text-sm sm:text-base">
                  {winner.toLowerCase() === address?.toLowerCase() ? "🎉 You Won!" : "Game Over"}
                </p>
                {winner.toLowerCase() === address?.toLowerCase() && (
                  <>
                    {claimableReward && claimableReward > BigInt(0) && !rewardClaimed && (
                      <button
                        onClick={handleClaimReward}
                        disabled={isPending || isConfirming}
                        className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg border border-green-500/30 transition-all text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap"
                      >
                        <Trophy className="w-4 h-4" />
                        Claim Reward
                      </button>
                    )}
                    {rewardClaimed && (
                      <span className="text-green-400/70 text-xs sm:text-sm font-medium whitespace-nowrap">
                        ✓ Already Claimed
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Game Status - Draw */}
          {gameStatus === "finished" && (!winner || winner === "0x0000000000000000000000000000000000000000") && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center gap-3 sm:gap-4">
                <p className="text-blue-400 font-semibold text-sm sm:text-base">
                  🤝 Game is a Draw!
                </p>
              </div>
              <p className="text-blue-300/80 text-xs sm:text-sm mt-1">
                No winner - your bet has been automatically refunded to your wallet.
              </p>
            </div>
          )}

          {gameStatus === "waiting" && canJoin && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <p className="text-blue-400 mb-1.5 sm:mb-2 text-xs sm:text-sm md:text-base">Select your first move to join this game</p>
              {selectedJoinMove !== null && (
                <p className="text-xs sm:text-sm text-blue-300">Selected cell: {selectedJoinMove}</p>
              )}
            </div>
          )}

          {gameStatus === "active" && isPlayerTurn && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 font-semibold text-xs sm:text-sm md:text-base">Your turn! Make a move.</p>
            </div>
          )}

          {gameStatus === "active" && !isPlayerTurn && playerTwo && (
            <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg border ${canForfeit ? "bg-orange-500/20 border-orange-500/30" : "bg-gray-500/20 border-gray-500/30"}`}>
              {canForfeit ? (
                <div>
                  <p className="text-orange-400 font-semibold text-xs sm:text-sm md:text-base mb-1">
                    ⏰ Opponent has timed out!
                  </p>
                  <p className="text-orange-300/80 text-xs sm:text-sm">
                    Your opponent hasn't made their move within the time limit. You can claim timeout victory and win the bet.
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 text-xs sm:text-sm md:text-base">Waiting for opponent's move...</p>
              )}
            </div>
          )}

          {/* Game Board */}
          <div className="mb-4 sm:mb-6">
            <GameBoard
              board={board}
              onCellClick={handleCellClick}
              disabled={gameStatus === "finished" || (gameStatus === "active" && !isPlayerTurn) || (gameStatus === "waiting" && !canJoin)}
              winner={winner && winner !== "0x0000000000000000000000000000000000000000" ? (isPlayer1 ? "X" : "O") : null}
              winningCells={winningCells}
              boardSize={boardSize}
            />
          </div>

          {/* Actions - Forfeit button only shows to the player who made the last move (waiting for opponent) */}
          <div className="flex gap-2 sm:gap-3">
            {gameStatus === "active" && canForfeit && !isPlayerTurn && (isPlayer1 || isPlayer2) && (
              <button
                onClick={() => setShowForfeitModal(true)}
                className="px-4 sm:px-6 py-1.5 sm:py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/30 transition-all text-xs sm:text-sm md:text-base"
              >
                Claim Timeout Victory
              </button>
            )}
          </div>

          {error && (
            <div className="mt-3 sm:mt-4 flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs sm:text-sm">
              <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}
        </div>
      </div>

      <ForfeitModal
        isOpen={showForfeitModal}
        onClose={() => setShowForfeitModal(false)}
        onConfirm={handleForfeit}
        gameId={gameId.toString()}
        isLoading={isPending || isConfirming}
      />

      <JoinGameModal
        isOpen={showJoinConfirmModal}
        onClose={() => {
          setShowJoinConfirmModal(false);
          setSelectedJoinMove(null);
        }}
        onConfirm={handleConfirmJoin}
        betAmount={betAmount}
        isLoading={isPending || isConfirming}
      />
    </div>
  );
}
