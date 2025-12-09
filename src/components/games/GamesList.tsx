"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, Coins, Users, Play, Loader2, AlertTriangle, Grid3x3, Trophy } from "lucide-react";
import { useAccount } from "wagmi";
import { Address } from "viem";
import { CountdownTimer } from "./CountdownTimer";
import { usePlayerData } from "@/hooks/useGameData";
import { BetAmountDisplay } from "@/components/common/TokenDisplay";

export interface Game {
  id: string;
  gameId: bigint;
  player1: string;
  player2: string | null;
  betAmount: bigint;
  status: "waiting" | "active" | "finished";
  currentPlayer: string | null;
  winner: string | null;
  createdAt: Date;
  timeRemaining?: bigint | null;
  canForfeit?: boolean;
  boardSize?: number;
}

interface GamesListProps {
  games: Game[];
  loading?: boolean;
  onGameClick?: (gameId: bigint) => void;
}

// Helper component to display player with username
function PlayerDisplay({ 
  playerAddress, 
  isWinner = false,
  isPlayer1 = false,
  isPlayer2 = false,
  showTrophy = false,
  isFinishedGame = false
}: { 
  playerAddress: string; 
  isWinner?: boolean;
  isPlayer1?: boolean;
  isPlayer2?: boolean;
  showTrophy?: boolean;
  isFinishedGame?: boolean;
}) {
  const { player } = usePlayerData(playerAddress as Address);
  const username = player && typeof player === "object" && "username" in player 
    ? (player.username as string) 
    : null;

  // Color scheme for finished games: Winner = Gold, Loser = White
  // For active games: Winner = Green, Player 1 (X) = Blue, Player 2 (O) = Orange
  let textColor = "text-white";
  let usernameColor = "text-gray-400";
  let trophyColor = "text-green-400";

  if (isFinishedGame) {
    if (isWinner) {
      // Winner in finished game = Gold
      textColor = "text-yellow-400";
      usernameColor = "text-yellow-300";
      trophyColor = "text-yellow-400";
    } else {
      // Loser in finished game = White
      textColor = "text-white";
      usernameColor = "text-gray-300";
    }
  } else {
    // Active/waiting games
    if (isWinner) {
      // Winner = Green
      textColor = "text-green-400";
      usernameColor = "text-green-300";
      trophyColor = "text-green-400";
    } else if (isPlayer1) {
      // Player 1 (X) = Blue
      textColor = "text-blue-400";
      usernameColor = "text-blue-300";
    } else if (isPlayer2) {
      // Player 2 (O) = Orange
      textColor = "text-orange-400";
      usernameColor = "text-orange-300";
    }
  }

  return (
    <span className="text-sm flex items-center gap-1">
      <span className={`font-mono text-xs ${textColor}`}>
        {playerAddress.slice(0, 6)}...{playerAddress.slice(-4)}
      </span>
      {username && (
        <span className={`${usernameColor} ml-1`}>
          ({username})
        </span>
      )}
      {showTrophy && isWinner && (
        <span className="flex items-center gap-1">
          <span className="text-gray-500 mx-1">-</span>
          <Trophy className={`w-3 h-3 ${trophyColor}`} />
        </span>
      )}
    </span>
  );
}

export function GamesList({ games, loading = false, onGameClick }: GamesListProps) {
  const router = useRouter();
  const { address } = useAccount();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "text-gray-300 bg-white/5 border-white/10";
      case "active":
        return "text-blue-500 bg-blue-500/10 border-blue-500/30";
      case "finished":
        return "text-gray-400 bg-white/5 border-white/10";
      default:
        return "text-gray-400 bg-white/5 border-white/10";
    }
  };

  const canJoinGame = (game: Game) => {
    return game.status === "waiting" && game.player1.toLowerCase() !== address?.toLowerCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-300 text-lg mb-4">No games available</div>
        <button
          onClick={() => router.push("/create")}
          className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-medium transition-all border border-white/20"
        >
          Create New Game
        </button>
      </div>
    );
  }

  const handleCardClick = (game: Game, e: React.MouseEvent) => {
    // Don't trigger card click if clicking on a button
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    // Only make active/finished games clickable (waiting games use Join button)
    if (game.status === "active" || game.status === "finished") {
      if (onGameClick) {
        onGameClick(game.gameId);
      } else {
        router.push(`/play/${game.gameId.toString()}`);
      }
    }
  };

  return (
    <div className="space-y-4">
      {games.map((game) => {
        const isClickable = game.status === "active" || game.status === "finished";
        
        return (
        <div
          key={game.id}
          onClick={(e) => handleCardClick(game, e)}
          className={`bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-white/20 transition-all ${
            isClickable ? "cursor-pointer hover:bg-white/10" : ""
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              {/* Top row: Status badges and buttons (side by side on mobile) */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(game.status)}`}>
                    {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                  </span>
                  {game.status === "finished" && (!game.winner || game.winner === "0x0000000000000000000000000000000000000000") && (
                    <span className="text-xs font-medium text-blue-400">
                      Draw
                    </span>
                  )}
                  {game.player1.toLowerCase() === address?.toLowerCase() && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-white border border-white/20">
                      Your Game
                    </span>
                  )}
                </div>
                
                {/* Buttons on same level as status badges on mobile - only show Join Game for waiting games */}
                <div className="flex gap-2 md:hidden">
                  {canJoinGame(game) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onGameClick) {
                          onGameClick(game.gameId);
                        } else {
                          router.push(`/play/${game.gameId.toString()}`);
                        }
                      }}
                      className="flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1 rounded text-xs font-semibold transition-all border border-blue-500/30"
                    >
                      <Play className="w-3 h-3" />
                      Join Game
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-gray-300">
                  <Users className={`w-4 h-4 flex-shrink-0 ${
                    game.status === "finished" && game.winner && game.winner.toLowerCase() === game.player1.toLowerCase()
                      ? "text-yellow-400"
                      : game.winner && game.winner.toLowerCase() === game.player1.toLowerCase() 
                        ? "text-green-400" 
                        : "text-blue-400"
                  }`} />
                  <span className="text-gray-400 text-sm">Player 1: </span>
                  <PlayerDisplay 
                    playerAddress={game.player1} 
                    isPlayer1={true}
                    isWinner={game.winner ? game.winner.toLowerCase() === game.player1.toLowerCase() : false}
                    showTrophy={true}
                    isFinishedGame={game.status === "finished"}
                  />
                </div>

                {game.player2 ? (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Users className={`w-4 h-4 flex-shrink-0 ${
                      game.status === "finished" && game.winner && game.winner.toLowerCase() === game.player2.toLowerCase()
                        ? "text-yellow-400"
                        : game.winner && game.winner.toLowerCase() === game.player2.toLowerCase() 
                          ? "text-green-400" 
                          : "text-orange-400"
                    }`} />
                    <span className="text-gray-400 text-sm">Player 2: </span>
                    <PlayerDisplay 
                      playerAddress={game.player2} 
                      isPlayer2={true}
                      isWinner={game.winner ? game.winner.toLowerCase() === game.player2.toLowerCase() : false}
                      showTrophy={true}
                      isFinishedGame={game.status === "finished"}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Waiting for player 2</span>
                  </div>
                )}

                {/* Bet and Board side by side on mobile */}
                <div className="grid grid-cols-2 gap-2 md:contents">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Coins className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      <span className="text-gray-400">Bet: </span>
                      <BetAmountDisplay betAmount={game.betAmount} tokenAddress={game.tokenAddress} />
                    </span>
                  </div>

                  {game.boardSize && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Grid3x3 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        <span className="text-gray-400">Board: </span>
                        <span className="font-semibold text-white">{game.boardSize}x{game.boardSize}</span>
                      </span>
                    </div>
                  )}
                </div>

                {game.status === "active" && game.timeRemaining !== undefined && (
                  <div className="flex items-center gap-2">
                    {game.timeRemaining !== null ? (
                      <>
                        <CountdownTimer 
                          timeRemaining={game.timeRemaining} 
                          warningThreshold={3600}
                        />
                        {game.canForfeit && game.currentPlayer?.toLowerCase() !== address?.toLowerCase() && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Can Forfeit
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>Loading time...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Note for active games about 24-hour timeout */}
              {game.status === "active" && (
                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-xs text-yellow-400 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Note:</strong> If your opponent doesn't make a move within 24 hours, the last player to move can claim the reward. This applies unless the game is completed with a winner.
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Buttons for desktop (hidden on mobile) - only show Join Game for waiting games */}
            <div className="hidden md:flex gap-2">
              {canJoinGame(game) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onGameClick) {
                      onGameClick(game.gameId);
                    } else {
                      router.push(`/play/${game.gameId.toString()}`);
                    }
                  }}
                  className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-lg font-medium transition-all border border-blue-500/30"
                >
                  <Play className="w-4 h-4" />
                  Join Game
                </button>
              )}
            </div>
          </div>
          {isClickable && (
            <div className="mt-2 text-xs text-gray-500 text-right">
              {game.status === "finished" ? "Click to view →" : "Click to play →"}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}


