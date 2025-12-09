"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useBlOcXTacToe } from "@/hooks/useBlOcXTacToe";
import { usePlayerData } from "@/hooks/useGameData";
import { Loader2, Coins, AlertCircle, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";
import { waitForTransactionReceipt } from "viem/actions";
import { usePublicClient } from "wagmi";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Address } from "viem";
import blocxtactoeAbiArtifact from "@/abi/blocxtactoeabi.json";
import { CONTRACT_ADDRESS } from "@/config/constants";
import { TokenOption } from "./TokenDisplay";
import { useTokenBalance } from "@/hooks/useTokenBalance";

export function CreateGameContent() {
  const [betAmount, setBetAmount] = useState("");
  const [selectedMove, setSelectedMove] = useState<number | null>(null);
  const [selectedToken, setSelectedToken] = useState<Address>(
    "0x0000000000000000000000000000000000000000" as Address
  );
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [boardSize, setBoardSize] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [username, setUsername] = useState("");
  const { isConnected, address } = useAccount();
  const blocxtactoeAbi = (blocxtactoeAbiArtifact as { abi: unknown[] }).abi;
  const {
    createGame,
    isPending,
    isConfirming,
    isConfirmed,
    player,
    registerPlayer,
    supportedTokens,
    hash,
    error: contractError,
  } = useBlOcXTacToe();
  const router = useRouter();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  // Check if player is registered
  const { player: playerData } = usePlayerData(address);

  // Watch for registration confirmation
  useEffect(() => {
    if (isConfirmed && isRegistering && hash) {
      // Small delay to ensure transaction is fully processed
      setTimeout(() => {
        // Invalidate player data queries to refresh registration status
        queryClient.invalidateQueries({
          queryKey: ["readContract", { address: CONTRACT_ADDRESS }],
        });

        toast.success("Registration successful!");
        setUsername("");
        setShowRegistrationForm(false);
        setIsRegistering(false);
      }, 1000);
    }
  }, [isConfirmed, isRegistering, hash, queryClient]);

  // Watch for game creation confirmation
  useEffect(() => {
    if (isConfirmed && isCreatingGame && hash) {
      toast.success("Game created successfully! 🎮", {
        icon: "✅",
        style: {
          background: "#10b981",
          color: "#fff",
        },
      });
      setIsCreatingGame(false);
    }
  }, [isConfirmed, isCreatingGame, hash]);

  // Also watch for errors and reset state
  useEffect(() => {
    if (contractError && isRegistering) {
      setIsRegistering(false);
    }
  }, [contractError, isRegistering]);

  // Check registration status
  const isRegistered =
    (playerData &&
      typeof playerData === "object" &&
      "registered" in playerData &&
      playerData.registered) ||
    (player &&
      typeof player === "object" &&
      "registered" in player &&
      player.registered) ||
    false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!betAmount || parseFloat(betAmount) <= 0) {
      setError("Please enter a valid bet amount greater than 0");
      return;
    }

    if (selectedMove === null) {
      setError("Please select your first move");
      return;
    }

    const maxCells = boardSize * boardSize;
    if (selectedMove >= maxCells) {
      setError(`Invalid move. Board size is ${boardSize}x${boardSize}`);
      return;
    }

    if (!isRegistered) {
      setError("Please register as a player first");
      return;
    }

    try {
      setIsCreatingGame(true);
      const hash = await createGame(
        betAmount,
        selectedMove,
        selectedToken,
        boardSize
      );
      if (hash && publicClient) {
        // Show immediate feedback
        toast.success("Transaction submitted...", {
          icon: "⏳",
        });
        
        // Wait for confirmation
        const receipt = await waitForTransactionReceipt(publicClient, {
          hash: hash as `0x${string}`,
        });

        // Decode GameCreated event to get gameId
        const blocxtactoeAbiArtifact = await import(
          "@/abi/blocxtactoeabi.json"
        );
        const blocxtactoeAbi = (
          blocxtactoeAbiArtifact as unknown as { abi: unknown[] }
        ).abi;
        const { decodeEventLog } = await import("viem");

        let gameId: bigint | null = null;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: blocxtactoeAbi,
              data: log.data,
              topics: log.topics,
            });
            if (
              decoded.eventName === "GameCreated" &&
              decoded.args &&
              "gameId" in decoded.args
            ) {
              gameId = decoded.args.gameId as bigint;
              break;
            }
          } catch {
            // Not the event we're looking for
          }
        }

        if (gameId !== null) {
          // Success notification already shown by useEffect when isConfirmed
          router.push(`/play/${gameId.toString()}`);
        } else {
          // Success notification already shown by useEffect when isConfirmed
          router.push("/games");
        }
      }
    } catch (err: any) {
      setIsCreatingGame(false);
      const errorMessage =
        err?.message || err?.shortMessage || "Failed to create game";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleRegister = async () => {
    if (!username || username.trim().length === 0 || username.length > 32) {
      toast.error("Username must be between 1 and 32 characters");
      return;
    }

    try {
      setIsRegistering(true);
      await registerPlayer(username.trim());
      // The useEffect will handle the confirmation and cleanup
    } catch (err: any) {
      toast.error(err?.message || "Failed to register");
      setIsRegistering(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-2 sm:px-4 py-6 sm:py-8 md:py-12">
      <div className="max-w-md w-full">
        <div className="bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 md:p-8">
          <div className="text-center mb-4 sm:mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">
              Create New Game
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-400">
              Set your bet amount and make your first move
            </p>
          </div>

          {!isRegistered && (
            <div className="mb-4 sm:mb-6 bg-yellow-500/20 border border-yellow-500/30 rounded-lg overflow-hidden">
              <div className="p-3 sm:p-4">
                <p className="text-yellow-400 text-xs sm:text-sm mb-2 sm:mb-3">
                  Register username to create and join games.
                </p>
                {!showRegistrationForm ? (
                  <button
                    onClick={() => setShowRegistrationForm(true)}
                    className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-yellow-500/30 transition-all text-xs sm:text-sm"
                  >
                    Register Player Username
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs sm:text-sm text-yellow-400 mb-1.5 sm:mb-2">
                        Enter Username (max 32 characters)
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRegister();
                          }
                        }}
                        placeholder="Enter your username"
                        maxLength={32}
                        className="w-full px-3 py-2 bg-white/5 border border-yellow-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-transparent transition-all text-xs sm:text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRegister}
                        disabled={
                          isPending ||
                          isConfirming ||
                          isRegistering ||
                          !username.trim()
                        }
                        className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-yellow-500/30 transition-all disabled:opacity-50 text-xs sm:text-sm font-medium"
                      >
                        {isPending || isConfirming || isRegistering ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Registering...</span>
                          </span>
                        ) : (
                          "Register"
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowRegistrationForm(false);
                          setUsername("");
                        }}
                        disabled={isPending || isConfirming}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 text-yellow-400 rounded-lg border border-yellow-500/30 transition-all disabled:opacity-50 text-xs sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                Payment Token
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTokenSelector(!showTokenSelector)}
                  disabled={!isRegistered}
                  className="w-full flex items-center justify-between px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    {selectedToken ===
                    "0x0000000000000000000000000000000000000000" ? (
                      "ETH (Native)"
                    ) : (
                      <TokenLabel
                        tokenAddress={selectedToken}
                        abi={blocxtactoeAbi}
                      />
                    )}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showTokenSelector ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showTokenSelector &&
                supportedTokens &&
                Array.isArray(supportedTokens) ? (
                  <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedToken(
                          "0x0000000000000000000000000000000000000000" as Address
                        );
                        setShowTokenSelector(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-white/10 transition-colors ${
                        selectedToken ===
                        "0x0000000000000000000000000000000000000000"
                          ? "bg-orange-500/20 text-orange-400"
                          : "text-white"
                      }`}
                    >
                      <TokenOption 
                        tokenAddress={"0x0000000000000000000000000000000000000000" as Address}
                        isSelected={selectedToken === "0x0000000000000000000000000000000000000000"}
                      />
                    </button>
                    {(supportedTokens as Address[])
                      .filter(
                        (t) =>
                          t !== "0x0000000000000000000000000000000000000000"
                      )
                      .map((token: Address) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => {
                            setSelectedToken(token);
                            setShowTokenSelector(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-white/10 transition-colors ${
                            selectedToken === token
                              ? "bg-orange-500/20 text-orange-400"
                              : "text-white"
                          }`}
                        >
                          <TokenOption 
                            tokenAddress={token}
                            isSelected={selectedToken === token}
                          />
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Select the token to use for betting. ETH is the default.
              </p>
            </div>

            <div>
              <label
                htmlFor="betAmount"
                className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2"
              >
                Bet Amount <span className="text-[10px] sm:text-xs text-gray-400 font-normal">(Both players must pay this amount. Winner takes all.)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                  <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <input
                  id="betAmount"
                  type="number"
                  step="0.000000000000000001"
                  min="0.000000000000000001"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="0.000001"
                  className="block w-full pl-8 sm:pl-10 pr-2 sm:pr-3 py-2 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all text-sm sm:text-base"
                  required
                  disabled={!isRegistered}
                />
              </div>
              <TokenBalanceDisplay tokenAddress={selectedToken} />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                Board Size
              </label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setBoardSize(3);
                    setSelectedMove(null);
                  }}
                  disabled={!isRegistered}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all border text-xs sm:text-sm disabled:opacity-50 ${
                    boardSize === 3
                      ? "bg-orange-500/30 border-orange-500/50 text-orange-400"
                      : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  3 × 3
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBoardSize(5);
                    setSelectedMove(null);
                  }}
                  disabled={!isRegistered}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all border text-xs sm:text-sm disabled:opacity-50 ${
                    boardSize === 5
                      ? "bg-orange-500/30 border-orange-500/50 text-orange-400"
                      : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  5 × 5
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBoardSize(7);
                    setSelectedMove(null);
                  }}
                  disabled={!isRegistered}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all border text-xs sm:text-sm disabled:opacity-50 ${
                    boardSize === 7
                      ? "bg-orange-500/30 border-orange-500/50 text-orange-400"
                      : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  7 × 7
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                Select Your First Move
              </label>
              <div
                key={boardSize}
                className={
                  boardSize === 3
                    ? "grid grid-cols-3 gap-1.5 sm:gap-2"
                    : boardSize === 5
                    ? "grid grid-cols-5 gap-1.5 sm:gap-2"
                    : "grid grid-cols-7 gap-1.5 sm:gap-2"
                }
              >
                {Array.from({ length: boardSize * boardSize }).map(
                  (_, index) => (
                    <button
                      key={`${boardSize}-${index}`}
                      type="button"
                      onClick={() => setSelectedMove(index)}
                      disabled={!isRegistered}
                      className={`
                      aspect-square flex items-center justify-center rounded-lg border-2 transition-all
                      ${
                        selectedMove === index
                          ? "bg-white/20 border-white text-white"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    >
                      <span
                        className={`font-bold text-blue-500 ${
                          boardSize === 3
                            ? "text-xl"
                            : boardSize === 5
                            ? "text-lg"
                            : "text-sm"
                        }`}
                      >
                        X
                      </span>
                    </button>
                  )
                )}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Click a cell to place your first X move
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs sm:text-sm">
                <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || isConfirming || !isRegistered}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base md:text-lg transition-all border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="hidden sm:inline">Creating Game...</span>
                  <span className="sm:hidden">Creating...</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Create Game</span>
                  <span className="sm:hidden">Create</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function TokenLabel({
  tokenAddress,
  abi,
}: {
  tokenAddress: Address;
  abi: unknown[];
}) {
  const { data: tokenName } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "getTokenName",
    args: [tokenAddress],
    query: { enabled: !!tokenAddress },
  });

  const displayName =
    tokenAddress === "0x0000000000000000000000000000000000000000"
      ? "ETH (Native)"
      : tokenName && typeof tokenName === "string" && tokenName.length > 0
      ? tokenName
      : `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;

  return <>{displayName}</>;
}

function TokenBalanceDisplay({ tokenAddress }: { tokenAddress: Address }) {
  const { formatted: balance, isLoading } = useTokenBalance(tokenAddress);
  
  // Check if it's ETH (zero address)
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const normalizedAddress = tokenAddress.toLowerCase();
  const isETH = normalizedAddress === zeroAddress;

  // Get token name for display
  const { data: tokenName } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "getTokenName",
    args: !isETH && tokenAddress ? [tokenAddress] : undefined,
    query: { 
      enabled: !isETH && !!tokenAddress,
    },
  });

  // Extract symbol for balance display
  const tokenSymbol = isETH 
    ? "ETH" 
    : tokenName && typeof tokenName === "string" && tokenName.length > 0
    ? tokenName.split(" ")[0] // Get first word (e.g., "USDC" from "USDC (Base)")
    : "TOKEN";

  if (isLoading) {
    return (
      <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-400">
        Balance: Loading...
      </p>
    );
  }

  return (
    <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-400">
      Balance: <span className="text-green-400 font-medium">{parseFloat(balance).toFixed(4)} {tokenSymbol}</span>
    </p>
  );
}
