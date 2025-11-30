"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useMemo } from "react";
import { Address, parseEther, erc20Abi } from "viem";
import blocxtactoeAbiArtifact from "@/abi/blocxtactoeabi.json";
import { toast } from "react-hot-toast";
import { CONTRACT_ADDRESS } from "@/config/constants";

// Extract ABI array from Hardhat artifact
const blocxtactoeAbi = (blocxtactoeAbiArtifact as { abi: unknown[] }).abi;

// Helper to check if address is ETH (zero address)
const isETH = (tokenAddress: Address): boolean => {
  return tokenAddress === "0x0000000000000000000000000000000000000000";
};

// Helper function to extract error message
function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    if ("message" in err && typeof err.message === "string") {
      return err.message;
    }
    if ("shortMessage" in err && typeof err.shortMessage === "string") {
      return err.shortMessage;
    }
  }
  return "An unknown error occurred";
}

// Helper function to check token allowance
async function checkTokenAllowance(
  tokenAddress: Address,
  ownerAddress: Address,
  spenderAddress: Address
): Promise<bigint> {
  if (isETH(tokenAddress)) return BigInt(0); // ETH doesn't need allowance
  
  const { createPublicClient, http } = await import("viem");
  const { celo } = await import("wagmi/chains");
  
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(),
  });

  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [ownerAddress, spenderAddress],
  });

  return allowance;
}

export function useBlOcXTacToe() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // ============ READ FUNCTIONS ============

  // Get contract state
  const { data: moveTimeout } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "moveTimeout",
  });

  const { data: platformFeePercent } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "platformFeePercent",
  });

  const { data: platformFeeRecipient } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "platformFeeRecipient",
  });

  const { data: kFactor } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "kFactor",
  });

  const { data: paused } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "paused",
  });

  const { data: owner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "owner",
  });

  // Check if user is admin
  const { data: isAdmin } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "admins",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Get player info
  const { data: player } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "getPlayer",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Get latest game ID
  const { data: latestGameId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "getLatestGameId",
  });

  // Get supported tokens
  const { data: supportedTokens } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "getSupportedTokens",
  });

  // ============ WRITE FUNCTIONS ============

  // Admin Functions
  const addAdmin = async (adminAddress: Address) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "addAdmin",
        args: [adminAddress],
      });
      // Transaction submitted - toast removed per user request
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Failed to add admin");
    }
  };

  const removeAdmin = async (adminAddress: Address) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "removeAdmin",
        args: [adminAddress],
      });
      // Transaction submitted - toast removed per user request
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Failed to remove admin");
    }
  };

  const setMoveTimeout = async (newTimeout: bigint) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "setMoveTimeout",
        args: [newTimeout],
      });
      // Transaction submitted - toast removed per user request
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Failed to set timeout");
    }
  };

  const setPlatformFee = async (newFeePercent: bigint) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "setPlatformFee",
        args: [newFeePercent],
      });
      // Transaction submitted - toast removed per user request
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Failed to set platform fee");
    }
  };

  const setPlatformFeeRecipient = async (recipient: Address) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "setPlatformFeeRecipient",
        args: [recipient],
      });
      // Transaction submitted - toast removed per user request
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Failed to set fee recipient");
    }
  };

  const setKFactor = async (newKFactor: bigint) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "setKFactor",
        args: [newKFactor],
      });
      // Transaction submitted - toast removed per user request
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Failed to set K-Factor");
    }
  };

  const setSupportedToken = async (token: Address, supported: boolean, tokenName: string = "") => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "setSupportedToken",
        args: [token, supported, tokenName],
      });
      // Transaction submitted - toast removed per user request
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Failed to set token support");
    }
  };

  const pause = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "pause",
      });
      // Transaction submitted - toast removed per user request
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Failed to pause contract");
    }
  };

  const unpause = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "unpause",
      });
      // Transaction submitted - toast removed per user request
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Failed to unpause contract");
    }
  };

  // Token Approval Function
  const approveToken = async (tokenAddress: Address, amount: bigint): Promise<`0x${string}` | undefined> => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      throw new Error("Please connect your wallet");
    }
    if (isETH(tokenAddress)) {
      return undefined; // ETH doesn't need approval
    }
    
    try {
      // Check current allowance
      const currentAllowance = await checkTokenAllowance(tokenAddress, address, CONTRACT_ADDRESS);
      
      if (currentAllowance >= amount) {
        // Already has sufficient allowance
        return undefined;
      }
      
      // Request approval
      toast.loading("Requesting token approval...", { id: "token-approval" });
      
      const hash = await writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, amount],
      }) as `0x${string}` | undefined;
      
      if (hash) {
        // Wait for approval transaction
        const { createPublicClient, http } = await import("viem");
        const { celo } = await import("wagmi/chains");
        
        const publicClient = createPublicClient({
          chain: celo,
          transport: http(),
        });
        
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success("Token approved!", { id: "token-approval" });
      }
      
      return hash;
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Failed to approve token", { id: "token-approval" });
      throw err;
    }
  };

  // Check if token needs approval
  const needsApproval = async (tokenAddress: Address, amount: bigint): Promise<boolean> => {
    if (!address || isETH(tokenAddress)) return false;
    
    try {
      const allowance = await checkTokenAllowance(tokenAddress, address, CONTRACT_ADDRESS);
      return allowance < amount;
    } catch {
      return true; // Assume needs approval if check fails
    }
  };

  // Player Functions
  const registerPlayer = async (username: string): Promise<void> => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      throw new Error("Please connect your wallet");
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "registerPlayer",
        args: [username],
      });
      // Transaction submitted - toast removed per user request
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err) || "Failed to register player";
      toast.error(errorMsg);
      throw err;
    }
  };

  // Game Functions
  const createGame = async (betAmount: string, moveIndex: number, tokenAddress: Address = "0x0000000000000000000000000000000000000000" as Address, boardSize: number = 3): Promise<`0x${string}` | undefined> => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      throw new Error("Please connect your wallet");
    }
    if (boardSize !== 3 && boardSize !== 5 && boardSize !== 7) {
      toast.error("Board size must be 3, 5, or 7");
      throw new Error("Invalid board size");
    }
    try {
      const betAmountWei = parseEther(betAmount);
      
      // For ERC20 tokens, check and request approval first
      if (!isETH(tokenAddress)) {
        const needsApprovalCheck = await needsApproval(tokenAddress, betAmountWei);
        if (needsApprovalCheck) {
          await approveToken(tokenAddress, betAmountWei);
        }
      }
      
      const hash = await writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "createGame",
        args: [betAmountWei, moveIndex, tokenAddress, boardSize],
        value: isETH(tokenAddress) ? betAmountWei : undefined,
      }) as `0x${string}` | undefined;
      // Transaction submitted - toast removed per user request
      return hash;
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err) || "Failed to create game";
      toast.error(errorMsg);
      throw err;
    }
  };

  const joinGame = async (gameId: bigint, moveIndex: number) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      throw new Error("Please connect your wallet");
    }
    try {
      // Use useReadContract to get game data
      const { createPublicClient, http } = await import("viem");
      // const { baseSepolia } = await import("wagmi/chains"); // Base Sepolia - commented out
      // const { base } = await import("wagmi/chains"); // Base Mainnet - commented out
      const { celo } = await import("wagmi/chains");
      
      const publicClient = createPublicClient({
        chain: celo,
        transport: http(),
      });

      const game = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "getGame",
        args: [gameId],
      }) as {
        betAmount: bigint;
        tokenAddress: Address;
      } | null;
      
      if (!game) throw new Error("Game not found");
      
      const betAmount = game.betAmount;
      const tokenAddress = game.tokenAddress as Address;
      
      // For ERC20 tokens, check and request approval first
      if (!isETH(tokenAddress)) {
        const needsApprovalCheck = await needsApproval(tokenAddress, betAmount);
        if (needsApprovalCheck) {
          await approveToken(tokenAddress, betAmount);
        }
      }
      
      const hash = await writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "joinGame",
        args: [gameId, moveIndex],
        value: isETH(tokenAddress) ? betAmount : undefined,
      });
      // Transaction submitted - toast removed per user request
      return hash;
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err) || "Failed to join game";
      toast.error(errorMsg);
      throw err;
    }
  };

  const play = async (gameId: bigint, moveIndex: number) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      throw new Error("Please connect your wallet");
    }
    try {
      const hash = await writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "play",
        args: [gameId, moveIndex],
      });
      // Move submitted - toast removed per user request
      return hash;
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err) || "Failed to make move";
      toast.error(errorMsg);
      throw err;
    }
  };

  const forfeitGame = async (gameId: bigint) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      throw new Error("Please connect your wallet");
    }
    try {
      const hash = await writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "forfeitGame",
        args: [gameId],
      });
      // Transaction submitted - toast removed per user request
      return hash;
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err) || "Failed to forfeit game";
      toast.error(errorMsg);
      throw err;
    }
  };

  const claimReward = async (gameId: bigint) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      throw new Error("Please connect your wallet");
    }
    try {
      const hash = await writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "claimReward",
        args: [gameId],
      });
      // Claiming reward - toast removed per user request
      return hash;
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err) || "Failed to claim reward";
      toast.error(errorMsg);
      throw err;
    }
  };

  // Challenge Functions
  const createChallenge = async (challenged: Address, betAmount: string, tokenAddress: Address = "0x0000000000000000000000000000000000000000" as Address, boardSize: number = 3) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      throw new Error("Please connect your wallet");
    }
    if (boardSize !== 3 && boardSize !== 5 && boardSize !== 7) {
      toast.error("Board size must be 3, 5, or 7");
      throw new Error("Invalid board size");
    }
    try {
      const betAmountWei = parseEther(betAmount);
      
      // For ERC20 tokens, check and request approval first
      if (!isETH(tokenAddress)) {
        const needsApprovalCheck = await needsApproval(tokenAddress, betAmountWei);
        if (needsApprovalCheck) {
          await approveToken(tokenAddress, betAmountWei);
        }
      }
      
      const hash = await writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "createChallenge",
        args: [challenged, betAmountWei, tokenAddress, boardSize],
        value: isETH(tokenAddress) ? betAmountWei : undefined,
      });
      // Transaction submitted - toast removed per user request
      return hash;
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err) || "Failed to create challenge";
      toast.error(errorMsg);
      throw err;
    }
  };

  const acceptChallenge = async (challengeId: bigint, moveIndex: number) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      throw new Error("Please connect your wallet");
    }
    try {
      // Get challenge to know bet amount
      const { createPublicClient, http } = await import("viem");
      // const { baseSepolia } = await import("wagmi/chains"); // Base Sepolia - commented out
      // const { base } = await import("wagmi/chains"); // Base Mainnet - commented out
      const { celo } = await import("wagmi/chains");
      
      const publicClient = createPublicClient({
        chain: celo,
        transport: http(),
      });

      const challenge = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "getChallenge",
        args: [challengeId],
      }) as {
        betAmount: bigint;
        tokenAddress: Address;
      } | null;
      
      if (!challenge) throw new Error("Challenge not found");
      
      const betAmount = challenge.betAmount;
      const tokenAddress = challenge.tokenAddress as Address;
      
      // For ERC20 tokens, check and request approval first
      if (!isETH(tokenAddress)) {
        const needsApprovalCheck = await needsApproval(tokenAddress, betAmount);
        if (needsApprovalCheck) {
          await approveToken(tokenAddress, betAmount);
        }
      }
      
      const hash = await writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "acceptChallenge",
        args: [challengeId, moveIndex],
        value: isETH(tokenAddress) ? betAmount : undefined,
      });
      // Transaction submitted - toast removed per user request
      return hash;
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err) || "Failed to accept challenge";
      toast.error(errorMsg);
      throw err;
    }
  };

  // ============ READ HELPERS ============
  
  // These are used as hooks in components - see useGameData and useChallengeData hooks below
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getGame = async (_gameId: bigint) => {
    // This function signature is kept for compatibility
    // Components should use useReadContract directly or useGameData hook
    return null;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getChallenge = async (_challengeId: bigint) => {
    // This function signature is kept for compatibility
    // Components should use useReadContract directly or useChallengeData hook
    return null;
  };

  // Watch for transaction success (only show for non-registration transactions)
  // Registration has its own success handling in the components
  useMemo(() => {
    if (isConfirmed && hash) {
      // Only show generic confirmation if it's not a registration
      // Registration components handle their own success messages
      const isRegistration = false; // We can't determine this here, so we'll let components handle it
    }
  }, [isConfirmed, hash]);

  return {
    // State
    isConnected,
    address,
    isAdmin: isAdmin || (typeof owner === "string" && typeof address === "string" && owner.toLowerCase() === address.toLowerCase()),
    isOwner: typeof owner === "string" && typeof address === "string" && owner.toLowerCase() === address.toLowerCase(),
    player,
    moveTimeout,
    platformFeePercent,
    platformFeeRecipient,
    kFactor,
    paused,
    owner,
    supportedTokens,
    latestGameId,
    
    // Loading states
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
    
    // Admin functions
    addAdmin,
    removeAdmin,
    setMoveTimeout,
    setPlatformFee,
    setPlatformFeeRecipient,
    setKFactor,
    setSupportedToken,
    pause,
    unpause,
    
    // Player functions
    registerPlayer,
    
    // Game functions
    createGame,
    joinGame,
    play,
    forfeitGame,
    claimReward,
    
    // Challenge functions
    createChallenge,
    acceptChallenge,
    
    // Token functions
    approveToken,
    needsApproval,
    
    // Read helpers
    getGame,
    getChallenge,
  };
}

