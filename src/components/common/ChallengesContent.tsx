"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useBlOcXTacToe } from "@/hooks/useBlOcXTacToe";
import {
  usePlayerChallenges,
  useChallengeData,
  usePlayerData,
  useGameData,
} from "@/hooks/useGameData";
import {
  Loader2,
  Sword,
  CheckCircle,
  XCircle,
  UserPlus,
  Coins,
  ChevronDown,
  ChevronUp,
  Grid3X3,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { waitForTransactionReceipt } from "viem/actions";
import { usePublicClient, useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { formatEther, Address, isAddress } from "viem";
import { PlayerSearch } from "./PlayerSearch";
import { GameModal } from "@/components/games/GameModal";
import { BetAmountDisplay, TokenNameDisplay, TokenOption, TokenBalanceDisplay } from "./TokenDisplay";
import blocxtactoeAbiArtifact from "@/abi/blocxtactoeabi.json";
import { CONTRACT_ADDRESS } from "@/config/constants";

// Extract ABI array from Hardhat artifact
const blocxtactoeAbi = (blocxtactoeAbiArtifact as { abi: unknown[] }).abi;

export function ChallengesContent() {
  const { address, isConnected } = useAccount();
  const { createChallenge, acceptChallenge, isPending, isConfirming } =
    useBlOcXTacToe();
  const { challengeIds, isLoading: challengesLoading } =
    usePlayerChallenges(address);
  const publicClient = usePublicClient();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">(
    "incoming"
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [challengedAddress, setChallengedAddress] = useState("");
  const [betAmount, setBetAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<Address>(
    "0x0000000000000000000000000000000000000000" as Address
  );
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [boardSize, setBoardSize] = useState<number>(3);
  const [showPastChallenges, setShowPastChallenges] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<bigint | null>(null);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);

  const { player: playerData } = usePlayerData(address);
  const { supportedTokens } = useBlOcXTacToe();

  // Count incoming and outgoing challenges
  const challengeCounts = useChallengeCounts(challengeIds, address);

  const handleChallengeClick = (gameId: bigint) => {
    setSelectedGameId(gameId);
    setIsGameModalOpen(true);
  };

  const handleCloseGameModal = () => {
    setIsGameModalOpen(false);
    setSelectedGameId(null);
  };

  const handlePlayerSelect = (address: Address, username: string) => {
    setChallengedAddress(address);
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengedAddress || !betAmount || parseFloat(betAmount) <= 0) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const hash = await createChallenge(
        challengedAddress as Address,
        betAmount,
        selectedToken,
        boardSize
      );
      if (typeof hash === "string") {
        if (publicClient) {
          // Wait for confirmation
          await waitForTransactionReceipt(publicClient, {
            hash: hash as `0x${string}`,
          });
        }
        
        // Show success notification after confirmation
        toast.success("Challenge created");
        
        setShowCreateModal(false);
        setChallengedAddress("");
        setBetAmount("");
        setSelectedToken(
          "0x0000000000000000000000000000000000000000" as Address
        );
        setBoardSize(3);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create challenge");
    }
  };

  const handleAcceptChallenge = async (
    challengeId: bigint,
    moveIndex: number
  ) => {
    if (moveIndex === null || moveIndex === undefined) {
      toast.error("Please select your first move");
      return;
    }

    try {
      const hash = await acceptChallenge(challengeId, moveIndex);
      if (typeof hash === "string") {
        // Show immediate success notification
        toast.success("Challenge accepted! Starting game...");
        
        if (publicClient) {
          // Wait for confirmation in the background
          const receipt = await waitForTransactionReceipt(publicClient, {
            hash: hash as `0x${string}`,
          });

          // Decode ChallengeAccepted event to get gameId
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
                decoded.eventName === "ChallengeAccepted" &&
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
            router.push(`/play/${gameId.toString()}`);
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to accept challenge");
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <p className="text-gray-400 text-sm sm:text-base">
          Connect your wallet to view challenges
        </p>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 md:px-8 md:py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-1 sm:mb-2">
              Challenges
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-400">
              Challenge other players or accept incoming challenges
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all border border-orange-500/30 text-xs sm:text-sm w-full sm:w-auto"
          >
            <UserPlus className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Create Challenge</span>
            <span className="sm:hidden">Create</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 sm:mb-6">
          <button
            onClick={() => setActiveTab("incoming")}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm flex items-center gap-2 ${
              activeTab === "incoming"
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            <span>Incoming</span>
            {challengeCounts.incoming > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeTab === "incoming"
                  ? "bg-orange-500/30 text-orange-300"
                  : "bg-white/10 text-gray-300"
              }`}>
                {challengeCounts.incoming}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("outgoing")}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm flex items-center gap-2 ${
              activeTab === "outgoing"
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            <span>Outgoing</span>
            {challengeCounts.outgoing > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeTab === "outgoing"
                  ? "bg-orange-500/30 text-orange-300"
                  : "bg-white/10 text-gray-300"
              }`}>
                {challengeCounts.outgoing}
              </span>
            )}
          </button>
        </div>

        {/* Challenges List */}
        {challengesLoading ? (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-white animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Pending Challenges (not accepted yet) */}
            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              {challengeIds &&
              Array.isArray(challengeIds) &&
              challengeIds.length > 0 ? (
                <>
                  {/* Pending challenges */}
                  {challengeIds.map((challengeId) => (
                    <ChallengeCard
                      key={`pending-${challengeId.toString()}`}
                      challengeId={challengeId}
                      currentAddress={address}
                      onAccept={handleAcceptChallenge}
                      onGameClick={handleChallengeClick}
                      isPending={isPending || isConfirming}
                      showOnlyPending={true}
                      filterTab={activeTab}
                    />
                  ))}
                  {/* Active challenges (accepted, game in progress) */}
                  {challengeIds.map((challengeId) => (
                    <ChallengeCard
                      key={`active-${challengeId.toString()}`}
                      challengeId={challengeId}
                      currentAddress={address}
                      onAccept={handleAcceptChallenge}
                      onGameClick={handleChallengeClick}
                      isPending={isPending || isConfirming}
                      showOnlyActive={true}
                      filterTab={activeTab}
                    />
                  ))}
                </>
              ) : (
                <div className="text-center py-8 sm:py-12 bg-white/5 rounded-lg border border-white/10">
                  <Sword className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2 sm:mb-4" />
                  <p className="text-gray-400 text-sm sm:text-base">
                    {activeTab === "incoming" 
                      ? "No incoming challenges" 
                      : activeTab === "outgoing"
                      ? "No outgoing challenges"
                      : "No challenges found"}
                  </p>
                </div>
              )}
            </div>

            {/* Past Challenges Dropdown (only finished games) */}
            {challengeIds && Array.isArray(challengeIds) && challengeIds.length > 0 && (
              <div className="mt-6 sm:mt-8">
                <button
                  onClick={() => setShowPastChallenges(!showPastChallenges)}
                  className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-4"
                >
                  {showPastChallenges ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                  <span className="text-lg sm:text-xl font-semibold">
                    Past Challenges
                  </span>
                </button>
                
                {showPastChallenges && (
                  <div className="space-y-2 sm:space-y-3 md:space-y-4">
                    {challengeIds.map((challengeId) => (
                      <ChallengeCard
                        key={`past-${challengeId.toString()}`}
                        challengeId={challengeId}
                        currentAddress={address}
                        onAccept={handleAcceptChallenge}
                        onGameClick={handleChallengeClick}
                        isPending={isPending || isConfirming}
                        showOnlyFinished={true}
                        filterTab={activeTab}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Create Challenge Modal */}
        {showCreateModal && (
          <CreateChallengeModal
            challengedAddress={challengedAddress}
            setChallengedAddress={setChallengedAddress}
            betAmount={betAmount}
            setBetAmount={setBetAmount}
            selectedToken={selectedToken}
            setSelectedToken={setSelectedToken}
            showTokenSelector={showTokenSelector}
            setShowTokenSelector={setShowTokenSelector}
            supportedTokens={supportedTokens as Address[] | undefined}
            boardSize={boardSize}
            setBoardSize={setBoardSize}
            onPlayerSelect={handlePlayerSelect}
            onClose={() => {
              setShowCreateModal(false);
              setChallengedAddress("");
              setBetAmount("");
              setSelectedToken(
                "0x0000000000000000000000000000000000000000" as Address
              );
              setBoardSize(3);
            }}
            onSubmit={handleCreateChallenge}
            isPending={isPending || isConfirming}
          />
        )}

        {/* Game Modal for accepted challenges */}
        {selectedGameId !== null && (
          <GameModal
            gameId={selectedGameId}
            isOpen={isGameModalOpen}
            onClose={handleCloseGameModal}
          />
        )}
      </div>
    </div>
  );
}

function ChallengeCard({
  challengeId,
  currentAddress,
  onAccept,
  onGameClick,
  isPending,
  showOnlyPending = false,
  showOnlyActive = false,
  showOnlyFinished = false,
  filterTab,
}: {
  challengeId: bigint;
  currentAddress: string | undefined;
  onAccept: (challengeId: bigint, moveIndex: number) => void;
  onGameClick: (gameId: bigint) => void;
  isPending: boolean;
  showOnlyPending?: boolean;
  showOnlyActive?: boolean;
  showOnlyFinished?: boolean;
  filterTab?: "incoming" | "outgoing";
}) {
  const { challenge, isLoading } = useChallengeData(challengeId);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [selectedMove, setSelectedMove] = useState<number | null>(null);

  // Get game data to check if game is finished
  const gameId = challenge && Array.isArray(challenge) ? challenge[9] as bigint : 
    (challenge as { gameId?: bigint })?.gameId;
  const { game: gameData } = useGameData(
    gameId && gameId > BigInt(0) ? gameId : undefined
  );

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-lg border border-white/10 p-3 sm:p-4">
        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin" />
      </div>
    );
  }

  if (!challenge) return null;

  // Handle challenge as tuple or object
  // Order: challenger, challengerUsername, challenged, challengedUsername, betAmount, tokenAddress, boardSize, timestamp, accepted, gameId
  const challengeData = Array.isArray(challenge)
    ? {
        challenger: challenge[0] as Address,
        challengerUsername: challenge[1] as string,
        challenged: challenge[2] as Address,
        challengedUsername: challenge[3] as string,
        betAmount: challenge[4] as bigint,
        tokenAddress: challenge[5] as Address,
        boardSize: Number(challenge[6]) as number,
        timestamp: challenge[7] as bigint,
        accepted: challenge[8] as boolean,
        gameId: challenge[9] as bigint,
      }
    : (challenge as {
        challenger: Address;
        challengerUsername: string;
        challenged: Address;
        challengedUsername: string;
        betAmount: bigint;
        tokenAddress: Address;
        boardSize: number;
        timestamp: bigint;
        accepted: boolean;
        gameId: bigint;
      });

  // Determine game status from game data
  const gameStatus = gameData && typeof gameData === "object" && "status" in gameData
    ? (gameData as { status: number }).status
    : null;
  const isGameFinished = gameStatus === 1 || gameStatus === 2; // Ended or Forfeited
  const isGameActive = challengeData.accepted && !isGameFinished;

  // Filter based on props
  if (showOnlyPending && challengeData.accepted) return null;
  if (showOnlyActive && (!challengeData.accepted || isGameFinished)) return null;
  if (showOnlyFinished && (!challengeData.accepted || !isGameFinished)) return null;

  const isChallenger =
    challengeData.challenger?.toLowerCase() === currentAddress?.toLowerCase();
  const isChallenged =
    challengeData.challenged?.toLowerCase() === currentAddress?.toLowerCase();
  const canAccept = isChallenged && !challengeData.accepted;
  const isClickable = challengeData.accepted && challengeData.gameId && challengeData.gameId > BigInt(0);

  // Filter by tab: incoming = challenges where user is challenged, outgoing = challenges where user is challenger
  if (filterTab === "incoming" && !isChallenged) return null;
  if (filterTab === "outgoing" && !isChallenger) return null;

  const handleCardClick = () => {
    if (isClickable) {
      onGameClick(challengeData.gameId);
    }
  };

  // Determine status display
  const getStatusDisplay = () => {
    if (!challengeData.accepted) return { text: "Pending", color: "text-yellow-400" };
    if (isGameFinished) return { text: "Finished", color: "text-red-400" };
    return { text: "In Progress", color: "text-green-400" };
  };
  const statusDisplay = getStatusDisplay();

  return (
    <>
      <div 
        onClick={handleCardClick}
        className={`bg-white/5 rounded-lg border border-white/10 p-3 sm:p-4 md:p-6 hover:border-white/20 transition-all ${
          isClickable ? "cursor-pointer hover:bg-white/10" : ""
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          {/* Left side - Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Sword
              className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${
                isChallenger ? "text-orange-500" : "text-blue-500"
              }`}
            />
            <span className="text-white font-semibold text-sm sm:text-base truncate">
              {isChallenger ? "You challenged" : "Challenged by"}{" "}
              {isChallenger
                ? challengeData.challengedUsername
                : challengeData.challengerUsername}
            </span>
          </div>

          {/* Middle - Details (horizontal on desktop) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-400">
            <span>
              Bet:{" "}
              <span className="text-white">
                <BetAmountDisplay betAmount={challengeData.betAmount || BigInt(0)} tokenAddress={challengeData.tokenAddress} />
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Grid3X3 className="w-3 h-3" />
              <span className="text-white">
                {challengeData.boardSize || 3}×{challengeData.boardSize || 3}
              </span>
            </span>
            <span>
              Status:{" "}
              <span className={statusDisplay.color}>
                {statusDisplay.text}
              </span>
            </span>
            {challengeData.accepted && challengeData.gameId && (
              <span>
                Game:{" "}
                <span className="text-white">
                  #{challengeData.gameId.toString()}
                </span>
              </span>
            )}
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {canAccept && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAcceptModal(true);
                }}
                disabled={isPending}
                className="flex items-center gap-1.5 sm:gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all border border-green-500/30 disabled:opacity-50 text-xs sm:text-sm"
              >
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                Accept
              </button>
            )}
            {isClickable && !canAccept && (
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {isGameFinished ? "Click to view →" : "Click to play →"}
              </span>
            )}
          </div>
        </div>
      </div>

      {showAcceptModal && (
        <AcceptChallengeModal
          challengeId={challengeId}
          betAmount={challengeData.betAmount}
          tokenAddress={challengeData.tokenAddress}
          boardSize={challengeData.boardSize || 3}
          onClose={() => {
            setShowAcceptModal(false);
            setSelectedMove(null);
          }}
          onAccept={(moveIndex) => {
            onAccept(challengeId, moveIndex);
            setShowAcceptModal(false);
          }}
          selectedMove={selectedMove}
          setSelectedMove={setSelectedMove}
          isPending={isPending}
        />
      )}
    </>
  );
}

function CreateChallengeModal({
  challengedAddress,
  setChallengedAddress,
  betAmount,
  setBetAmount,
  selectedToken,
  setSelectedToken,
  showTokenSelector,
  setShowTokenSelector,
  supportedTokens,
  boardSize,
  setBoardSize,
  onPlayerSelect,
  onClose,
  onSubmit,
  isPending,
}: {
  challengedAddress: string;
  setChallengedAddress: (addr: string) => void;
  betAmount: string;
  setBetAmount: (amount: string) => void;
  selectedToken: Address;
  setSelectedToken: (token: Address) => void;
  showTokenSelector: boolean;
  setShowTokenSelector: (show: boolean) => void;
  supportedTokens: Address[] | undefined;
  boardSize: number;
  setBoardSize: (size: number) => void;
  onPlayerSelect: (address: Address, username: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Create Challenge
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
              Search Player by Username
            </label>
            <PlayerSearch onPlayerSelect={onPlayerSelect} />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
              Or Enter Address Directly
            </label>
            <input
              type="text"
              value={challengedAddress}
              onChange={(e) => setChallengedAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm sm:text-base"
            />
            {challengedAddress && (
              <>
                {challengedAddress.toLowerCase().startsWith("0x") && challengedAddress.length < 42 && (
                  <p className="text-gray-400 text-xs sm:text-sm mt-1">Please enter a complete address (42 characters)</p>
                )}
                {challengedAddress.toLowerCase().startsWith("0x") && challengedAddress.length >= 42 && !isAddress(challengedAddress as Address) && (
                  <p className="text-gray-400 text-xs sm:text-sm mt-1">Invalid address format</p>
                )}
                {challengedAddress && isAddress(challengedAddress as Address) && challengedAddress.toLowerCase() === "0x0000000000000000000000000000000000000000" && (
                  <p className="text-gray-400 text-xs sm:text-sm mt-1">Invalid address</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
              Payment Token
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTokenSelector(!showTokenSelector)}
                className="w-full flex items-center justify-between px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-all"
              >
                <span className="flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  {selectedToken ===
                  "0x0000000000000000000000000000000000000000" ? (
                    "ETH (Native)"
                  ) : (
                    <TokenOption tokenAddress={selectedToken} isSelected={false} />
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
                Array.isArray(supportedTokens) && (
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
                    {supportedTokens
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
                )}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Select the token to use for betting. ETH is the default.
            </p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
              Bet Amount
            </label>
            <div className="relative">
              <Coins className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <input
                type="number"
                step="0.000000000000000001"
                min="0.000000000000000001"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.01"
                className="w-full pl-8 sm:pl-10 pr-2 sm:pr-3 py-1.5 sm:py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm sm:text-base"
                required
              />
            </div>
            <TokenBalanceDisplay tokenAddress={selectedToken} />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
              Board Size
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBoardSize(3)}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all border text-xs sm:text-sm ${
                  boardSize === 3
                    ? "bg-orange-500/30 border-orange-500/50 text-orange-400"
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                }`}
              >
                3 × 3
              </button>
              <button
                type="button"
                onClick={() => setBoardSize(5)}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all border text-xs sm:text-sm ${
                  boardSize === 5
                    ? "bg-orange-500/30 border-orange-500/50 text-orange-400"
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                }`}
              >
                5 × 5
              </button>
              <button
                type="button"
                onClick={() => setBoardSize(7)}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all border text-xs sm:text-sm ${
                  boardSize === 7
                    ? "bg-orange-500/30 border-orange-500/50 text-orange-400"
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                }`}
              >
                7 × 7
              </button>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/20 disabled:opacity-50 text-xs sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !challengedAddress || !betAmount}
              className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg font-medium transition-all border border-orange-500/30 disabled:opacity-50 text-xs sm:text-sm"
            >
              {isPending ? "Creating..." : "Create Challenge"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AcceptChallengeModal({
  challengeId,
  betAmount,
  tokenAddress,
  boardSize,
  onClose,
  onAccept,
  selectedMove,
  setSelectedMove,
  isPending,
}: {
  challengeId: bigint;
  betAmount: bigint;
  tokenAddress?: Address;
  boardSize: number;
  onClose: () => void;
  onAccept: (moveIndex: number) => void;
  selectedMove: number | null;
  setSelectedMove: (move: number | null) => void;
  isPending: boolean;
}) {
  const totalCells = boardSize * boardSize;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Accept Challenge
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <p className="text-gray-300 text-sm sm:text-base">
            Bet Amount:{" "}
            <span className="text-white font-semibold">
              <BetAmountDisplay betAmount={betAmount} tokenAddress={tokenAddress} />
            </span>
          </p>
          <p className="text-gray-300 text-sm sm:text-base flex items-center gap-1">
            <Grid3X3 className="w-4 h-4" />
            Board Size:{" "}
            <span className="text-white font-semibold">
              {boardSize} × {boardSize}
            </span>
          </p>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
              Select Your First Move (O)
            </label>
            <div 
              className="grid gap-1.5 sm:gap-2"
              style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: totalCells }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedMove(index)}
                  disabled={isPending}
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
                  <span className={`font-bold text-orange-500 ${boardSize > 5 ? "text-sm" : "text-lg sm:text-xl"}`}>
                    O
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/20 disabled:opacity-50 text-xs sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => selectedMove !== null && onAccept(selectedMove)}
              disabled={isPending || selectedMove === null}
              className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg font-medium transition-all border border-green-500/30 disabled:opacity-50 text-xs sm:text-sm"
            >
              {isPending ? "Accepting..." : "Accept Challenge"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to count incoming and outgoing challenges
function useChallengeCounts(
  challengeIds: bigint[] | undefined,
  currentAddress: string | undefined
) {
  const publicClient = usePublicClient();
  const [incoming, setIncoming] = useState(0);
  const [outgoing, setOutgoing] = useState(0);

  useEffect(() => {
    if (!challengeIds || !Array.isArray(challengeIds) || challengeIds.length === 0 || !currentAddress || !publicClient) {
      setIncoming(0);
      setOutgoing(0);
      return;
    }

    let isCancelled = false;

    const countChallenges = async () => {
      let incomingCount = 0;
      let outgoingCount = 0;

      try {
        const promises = challengeIds.map(async (challengeId) => {
          try {
            const challenge = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: blocxtactoeAbi,
              functionName: "getChallenge",
              args: [challengeId],
            });

            if (challenge && Array.isArray(challenge) && challenge.length >= 3) {
              const challenger = challenge[0] as Address;
              const challenged = challenge[2] as Address;

              const isChallenger = challenger?.toLowerCase() === currentAddress?.toLowerCase();
              const isChallenged = challenged?.toLowerCase() === currentAddress?.toLowerCase();

              return { isChallenger, isChallenged };
            }
          } catch (error) {
            // Ignore errors for individual challenges
          }
          return null;
        });

        const results = await Promise.all(promises);

        if (!isCancelled) {
          results.forEach((result) => {
            if (result) {
              if (result.isChallenger) outgoingCount++;
              if (result.isChallenged) incomingCount++;
            }
          });

          setIncoming(incomingCount);
          setOutgoing(outgoingCount);
        }
      } catch (error) {
        // Ignore overall errors
      }
    };

    countChallenges();

    return () => {
      isCancelled = true;
    };
  }, [challengeIds, currentAddress, publicClient]);

  return { incoming, outgoing };
}
