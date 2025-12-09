"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { GameBoard, BoardState, CellValue } from "@/components/games/GameBoard";
import { CountdownTimer } from "@/components/games/CountdownTimer";
import { ForfeitModal } from "@/components/games/ForfeitModal";
import { JoinGameModal } from "@/components/games/JoinGameModal";
import { useBlOcXTacToe } from "@/hooks/useBlOcXTacToe";
import { useGameData, usePlayerData } from "@/hooks/useGameData";
import { Loader2, Coins, Users, AlertCircle, Clock, X, Trophy, Share2, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import { Address } from "viem";
import blocxtactoeAbiArtifact from "@/abi/blocxtactoeabi.json";
import { CONTRACT_ADDRESS } from "@/config/constants";
import { BetAmountDisplay, TokenNameDisplay } from "@/components/common/TokenDisplay";

// Extract ABI array from Hardhat artifact
const blocxtactoeAbi = (blocxtactoeAbiArtifact as { abi: unknown[] }).abi;

type GameStatus = "waiting" | "active" | "finished";

interface GameModalProps {
  gameId: bigint;
  isOpen: boolean;
  onClose: () => void;
}

export function GameModal({ gameId, isOpen, onClose }: GameModalProps) {
  const { address, isConnected } = useAccount();
  const { play, joinGame, forfeitGame, claimReward, isPending, isConfirming, isConfirmed } = useBlOcXTacToe();
  const queryClient = useQueryClient();

  // Get game data using hook
  const { game, timeRemaining, isLoading: isLoadingGame } = useGameData(gameId);
  
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
  
  // Get player usernames - safely extract addresses
  const player1Address = game && typeof game === "object" && "playerOne" in game 
    ? (game as { playerOne: string }).playerOne 
    : undefined;
  
  const player2Address = game && typeof game === "object" && "playerTwo" in game 
    ? (game as { playerTwo: string | null }).playerTwo 
    : undefined;
  
  const { player: player1Data } = usePlayerData(
    player1Address && player1Address !== "0x0000000000000000000000000000000000000000"
      ? player1Address as Address 
      : undefined
  );
  
  const { player: player2Data } = usePlayerData(
    player2Address && player2Address !== "0x0000000000000000000000000000000000000000" && player2Address !== null
      ? player2Address as Address 
      : undefined
  );
  
  const gameRef = useRef<HTMLDivElement>(null);

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [boardSize, setBoardSize] = useState<number>(3);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setBoard(Array(9).fill(null));
      setGameStatus("waiting");
      setCanJoin(false);
      setIsPlayerTurn(false);
      setLoadingGame(true);
      setError(null);
      setWinningCells([]);
      setCanForfeit(false);
      setSelectedJoinMove(null);
      setBoardSize(3);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Update game state function - must be defined before useEffects that use it
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

  // Fetch board data using multicall to batch all reads
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
          abi: blocxtactoeAbi as any,
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

  useEffect(() => {
    if (game && typeof game === "object" && "playerOne" in game) {
      updateGameState();
    }
  }, [updateGameState, isConnected]);

  useEffect(() => {
    if (game && typeof game === "object" && "playerOne" in game && "boardSize" in game) {
      fetchBoardData();
    }
  }, [fetchBoardData]);

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
    if (gameStatus === "active" && !isPlayerTurn && isOpen) {
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
  }, [gameStatus, isPlayerTurn, isOpen, fetchBoardData, queryClient, gameId]);

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

  const getPlayerUsername = (playerAddress: string): string | null => {
    if (!playerAddress || !game || typeof game !== "object" || !("playerOne" in game)) return null;
    
    const isPlayer1 = (game as { playerOne: string }).playerOne.toLowerCase() === playerAddress.toLowerCase();
    const playerData = isPlayer1 ? player1Data : player2Data;
    
    if (playerData && typeof playerData === "object" && "username" in playerData) {
      return playerData.username as string;
    }
    return null;
  };

  const handleShare = async () => {
    if (!game || !address) return;
    
    const { playerOne, playerTwo, betAmount, winner } = game as {
      playerOne: string;
      playerTwo: string | null;
      betAmount: bigint;
      winner: string | null;
    };
    
    const isWinner = winner && winner.toLowerCase() === address.toLowerCase();
    if (!isWinner) {
      toast.error("Only winners can share their victory!");
      return;
    }
    
    try {
      // Generate screenshot using html2canvas if available, or use a simple text share
      const shareText = `Just won ${formatEther(betAmount || BigInt(0))} ETH playing BlOcXTacToe! 🎮\n\nIf you think you're good enough, come play me!\n\nGame ID: ${gameId.toString()}\nWinner: ${address.slice(0, 6)}...${address.slice(-4)}`;
      
      const shareUrl = `https://blocxtactoe.vercel.app/play/${gameId.toString()}`;
      
      if (navigator.share) {
        await navigator.share({
          title: "I just won at BlOcXTacToe!",
          text: shareText,
          url: shareUrl,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast.success("Share text copied to clipboard!");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        // Try fallback
        try {
          const shareText = `Just won ${formatEther(betAmount || BigInt(0))} ETH playing BlOcXTacToe! 🎮\n\nIf you think you're good enough, come play me!\n\nGame ID: ${gameId.toString()}\nWinner: ${address.slice(0, 6)}...${address.slice(-4)}`;
          await navigator.clipboard.writeText(shareText);
          toast.success("Share text copied to clipboard!");
        } catch {
          toast.error("Failed to share");
        }
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all queries related to this game
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          if (Array.isArray(queryKey) && queryKey.length > 0) {
            const firstKey = queryKey[0];
            if (typeof firstKey === "object" && firstKey !== null) {
              // Check if it's a wagmi readContract query
              if ("address" in firstKey && firstKey.address === CONTRACT_ADDRESS) {
                if ("args" in firstKey && Array.isArray(firstKey.args) && firstKey.args[0] === gameId) {
                  return true;
                }
              }
            }
          }
          return false;
        },
      });
      toast.success("Game data refreshed");
    } catch (error) {
      console.error("Refresh error:", error);
      // Fallback: just show success message
      toast.success("Refreshing...");
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    }
  };

  if (!isOpen) return null;

  // Show loading state while game data is being fetched
  // Only show loading if game data is not available yet, or if we're still loading
  if (loadingGame || isLoadingGame || !game || typeof game !== "object" || !("playerOne" in game)) {
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-md z-50"
          onClick={onClose}
        />
        {/* Modal */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-16 sm:pt-4 overflow-y-auto">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-center">
              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-white animate-spin" />
            </div>
          </div>
        </div>
      </>
    );
  }

  // Safely extract game data
  let playerOne: string;
  let playerTwo: string | null = null;
  let betAmount: bigint;
  let winner: string | null = null;

  try {
    const gameData = game as {
      playerOne: string;
      playerTwo: string | null;
      betAmount: bigint;
      winner: string | null;
    };
    playerOne = gameData.playerOne;
    playerTwo = gameData.playerTwo;
    betAmount = gameData.betAmount;
    winner = gameData.winner;
  } catch (err) {
    console.error("Error parsing game data:", err);
    return (
      <>
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-md z-50"
          onClick={onClose}
        />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 max-w-2xl w-full">
            <p className="text-red-400 text-center">Error loading game data</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-white/10 text-white rounded-lg">
              Close
            </button>
          </div>
        </div>
      </>
    );
  }

  const isPlayer1 = address?.toLowerCase() === playerOne.toLowerCase();
  const isPlayer2 = playerTwo && address?.toLowerCase() === playerTwo.toLowerCase();

  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pt-16 sm:pt-4 overflow-y-auto">
        <div ref={gameRef} className="bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-4 md:p-6 lg:p-8 max-w-4xl w-full my-auto relative">
          {/* Top Action Buttons */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 right-3 sm:right-4 flex justify-between items-start z-10">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20 disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-white ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20"
              aria-label="Close"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>

          {/* Game Info - Add top padding to avoid buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 pt-10 sm:pt-12">
            {/* Bet Amount / Bet Total */}
            <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 border border-white/10">
              <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 mb-0.5 sm:mb-1">
                <Coins className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">
                  {playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000" ? "Bet Total" : "Bet Amount"}
                </span>
              </div>
              <p className="text-white font-semibold text-sm sm:text-base md:text-lg">
                <BetAmountDisplay 
                  betAmount={playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000" 
                    ? (betAmount || BigInt(0)) * BigInt(2)
                    : betAmount || BigInt(0)} 
                  tokenAddress={tokenAddress} 
                />
              </p>
            </div>
            {/* Players */}
            <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 border border-white/10">
              <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 mb-0.5 sm:mb-1">
                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Players</span>
              </div>
              <p className="text-white font-semibold text-sm sm:text-base">
                {playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000" ? "2/2" : "1/2"}
              </p>
            </div>
            {/* Time Remaining */}
            <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-4 border border-white/10 col-span-2 sm:col-span-1">
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
              <p className="text-blue-400 font-mono text-xs sm:text-sm truncate">
                {playerOne.slice(0, 6)}...{playerOne.slice(-4)}
                {getPlayerUsername(playerOne) && (
                  <span className="text-blue-300 ml-1">({getPlayerUsername(playerOne)})</span>
                )}
              </p>
              {isPlayer1 && <span className="text-[10px] sm:text-xs text-green-400 mt-0.5 sm:mt-1 block">You</span>}
            </div>
            {playerTwo && playerTwo !== "0x0000000000000000000000000000000000000000" ? (
              <div className={`p-2 sm:p-3 md:p-4 rounded-lg border ${isPlayer2 ? "bg-white/10 border-white/30" : "bg-white/5 border-white/10"}`}>
                <p className="text-xs sm:text-sm text-gray-400 mb-0.5 sm:mb-1">Player 2 (O)</p>
                <p className="text-orange-400 font-mono text-xs sm:text-sm truncate">
                  {playerTwo.slice(0, 6)}...{playerTwo.slice(-4)}
                  {getPlayerUsername(playerTwo) && (
                    <span className="text-orange-300 ml-1">({getPlayerUsername(playerTwo)})</span>
                  )}
                </p>
                {isPlayer2 && <span className="text-[10px] sm:text-xs text-green-400 mt-0.5 sm:mt-1 block">You</span>}
              </div>
            ) : (
              <div className="p-2 sm:p-3 md:p-4 rounded-lg border border-white/10 bg-white/5">
                <p className="text-xs sm:text-sm text-gray-400 mb-0.5 sm:mb-1">Player 2 (O)</p>
                <p className="text-gray-500 text-xs sm:text-sm">Waiting for player...</p>
              </div>
            )}
          </div>

          {/* Game Status */}
          {/* Draw Game Message */}
          {gameStatus === "finished" && (!winner || winner === "0x0000000000000000000000000000000000000000") && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <p className="text-blue-400 font-semibold text-sm sm:text-base">
                  🤝 Game Ended in a Draw
                </p>
              </div>
              <p className="text-blue-300/80 text-xs sm:text-sm mt-1">
                No winner - your bet has been automatically refunded to your wallet.
              </p>
            </div>
          )}

          {/* Winner/Loser Message */}
          {gameStatus === "finished" && winner && winner !== "0x0000000000000000000000000000000000000000" && (
            <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg border ${
              winner.toLowerCase() === address?.toLowerCase() 
                ? "bg-green-500/20 border-green-500/30" 
                : "bg-red-500/20 border-red-500/30"
            }`}>
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                <p className={`font-semibold text-sm sm:text-base ${
                  winner.toLowerCase() === address?.toLowerCase() 
                    ? "text-green-400" 
                    : "text-red-400"
                }`}>
                  {winner.toLowerCase() === address?.toLowerCase() 
                    ? "🎉 You Won!" 
                    : "Game Over - You Lost"}
                </p>
                {winner.toLowerCase() === address?.toLowerCase() && (
                  <>
                    {claimableReward && typeof claimableReward === "bigint" && claimableReward > BigInt(0) && typeof rewardClaimed === "boolean" && !rewardClaimed && (
                      <button
                        onClick={handleClaimReward}
                        disabled={isPending || isConfirming}
                        className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg border border-green-500/30 transition-all text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap"
                      >
                        <Trophy className="w-4 h-4" />
                        Claim Reward
                      </button>
                    )}
                    {typeof rewardClaimed === "boolean" && rewardClaimed && (
                      <span className="text-green-400/70 text-xs sm:text-sm font-medium whitespace-nowrap">
                        ✓ Already Claimed
                      </span>
                    )}
                  </>
                )}
              </div>
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
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-500/20 border border-gray-500/30 rounded-lg">
              <p className="text-gray-400 text-xs sm:text-sm md:text-base">Waiting for opponent's move...</p>
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

          {/* Actions */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {gameStatus === "active" && canForfeit && (
              <button
                onClick={() => setShowForfeitModal(true)}
                className="px-4 sm:px-6 py-1.5 sm:py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/30 transition-all text-xs sm:text-sm md:text-base"
              >
                Forfeit Game
              </button>
            )}
            
            {gameStatus === "finished" && winner && winner.toLowerCase() === address?.toLowerCase() && typeof rewardClaimed === "boolean" && rewardClaimed && (
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 sm:px-6 py-1.5 sm:py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg border border-blue-500/30 transition-all text-xs sm:text-sm md:text-base"
              >
                <Share2 className="w-4 h-4" />
                Share Victory
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
    </>
  );
}

