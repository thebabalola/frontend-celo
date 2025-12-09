"use client";

import { useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESS } from "@/config/constants";
import blocxtactoeAbiArtifact from "@/abi/blocxtactoeabi.json";
import { toast } from "react-hot-toast";

// Extract ABI array from Hardhat artifact
const blocxtactoeAbi = (blocxtactoeAbiArtifact as { abi: unknown[] }).abi;

export function useCounter() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Read current counter value
  const { data: counter, refetch: refetchCounter } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: blocxtactoeAbi,
    functionName: "getCounter",
    query: {
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  // Increment counter
  const increment = async () => {
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "incrementCounter",
      });
    } catch (err) {
      console.error("Error incrementing counter:", err);
      toast.error("Failed to increment counter");
    }
  };

  // Decrement counter
  const decrement = async () => {
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: blocxtactoeAbi,
        functionName: "decrementCounter",
      });
    } catch (err) {
      console.error("Error decrementing counter:", err);
      toast.error("Failed to decrement counter");
    }
  };

  // Show toast on success
  useEffect(() => {
    if (isConfirmed) {
      toast.success("Transaction confirmed!");
      refetchCounter();
    }
  }, [isConfirmed, refetchCounter]);

  return {
    counter: counter !== undefined ? BigInt(counter.toString()) : BigInt(0),
    increment,
    decrement,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    refetchCounter,
  };
}

