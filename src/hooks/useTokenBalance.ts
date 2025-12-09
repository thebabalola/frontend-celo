"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { Address, formatEther, formatUnits } from "viem";

// Standard ERC20 ABI for balanceOf and decimals
const erc20Abi = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

export function useTokenBalance(tokenAddress: Address | undefined) {
  const { address } = useAccount();
  const isETH = !tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000";

  // For ETH, use wagmi's useBalance hook
  const { data: ethBalance, isLoading: isLoadingETH } = useBalance({
    address,
    query: {
      enabled: isETH && !!address,
    },
  });

  // For ERC20 tokens, read balanceOf
  const { data: tokenBalance, isLoading: isLoadingToken } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !isETH && !!tokenAddress && !!address,
    },
  });

  // Get decimals for ERC20 tokens
  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    query: {
      enabled: !isETH && !!tokenAddress,
    },
  });

  if (isETH) {
    return {
      balance: ethBalance?.value || BigInt(0),
      formatted: ethBalance?.formatted || "0",
      isLoading: isLoadingETH,
      decimals: 18,
    };
  }

  const balance = (tokenBalance as bigint) || BigInt(0);
  const tokenDecimals = (decimals as number) || 18;
  const formatted = formatUnits(balance, tokenDecimals);

  return {
    balance,
    formatted,
    isLoading: isLoadingToken,
    decimals: tokenDecimals,
  };
}

