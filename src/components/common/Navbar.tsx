"use client";

import Link from "next/link";
import { useAppKitAccount, useAppKit } from "@reown/appkit/react";
import { useDisconnect } from "@reown/appkit/react";
import { useWalletInfo } from "@reown/appkit/react";
import { useAccount, useDisconnect as useWagmiDisconnect, useConnectors, useConnect, useChainId, useSwitchChain } from "wagmi";
import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { SUPPORTED_CHAIN_ID } from "@/config/constants";
import { toast } from "react-hot-toast";
export function Navbar() {
  const [mounted, setMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // AppKit hooks
  const { address: appkitAddress, isConnected: appkitIsConnected } = useAppKitAccount();
  const { open, close } = useAppKit();
  const { walletInfo } = useWalletInfo();
  const { disconnect: appkitDisconnect } = useDisconnect();

  // Wagmi hooks
  const { address: wagmiAddress, isConnected: wagmiIsConnected, connector } = useAccount();
  const { disconnect: wagmiDisconnect } = useWagmiDisconnect();
  const { connect } = useConnect();
  const connectors = useConnectors();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const [isInFarcasterFrame, setIsInFarcasterFrame] = useState(false);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [hasSwitchedChain, setHasSwitchedChain] = useState(false);

  const address = appkitAddress || wagmiAddress;
  const isConnected = appkitIsConnected || wagmiIsConnected;

  useEffect(() => setMounted(true), []);

  // Auto-switch to Celo when wallet connects and is on wrong chain
  useEffect(() => {
    if (isConnected && chainId && chainId !== SUPPORTED_CHAIN_ID && !hasSwitchedChain && !isSwitchingChain) {
      console.log(`Current chain: ${chainId}, switching to Celo (${SUPPORTED_CHAIN_ID})...`);
      setHasSwitchedChain(true);
      
      try {
        switchChain(
          { chainId: SUPPORTED_CHAIN_ID },
          {
            onSuccess: () => {
              toast.success("Switched to Base");
              console.log("Successfully switched to Base");
            },
            onError: (error) => {
              console.error("Failed to switch chain:", error);
              toast.error("Please switch to Base manually");
              setHasSwitchedChain(false); // Reset to allow retry
            },
          }
        );
        } catch (error) {
        console.error("Error switching chain:", error);
        toast.error("Please switch to Base manually");
        setHasSwitchedChain(false);
      }
    }
  }, [isConnected, chainId, hasSwitchedChain, isSwitchingChain, switchChain]);

  // Reset hasSwitchedChain when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setHasSwitchedChain(false);
    }
  }, [isConnected]);

  // Check if we're in a Farcaster Frame context and auto-connect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const inFrame = window.location.href.includes('farcaster') || 
                     navigator.userAgent.includes('Farcaster') ||
                     window.location.href.includes('warpcast') ||
                     navigator.userAgent.includes('Warpcast') ||
                     window.location.href.includes('miniapps') ||
                     window.location.href.includes('blocxtactoe') ||
                     window.location.search.includes('farcaster') ||
                     (window as any).farcaster ||
                     (window as any).warpcast ||
                     (window as any).miniapp ||
                     window.location.href.includes('farcaster.xyz/miniapps');
      
      setIsInFarcasterFrame(inFrame);
      // Assume frame is ready if we're in a Farcaster context
      if (inFrame) {
        setIsFrameReady(true);
      }
      
      // Auto-connect to Farcaster if in Farcaster Frame and not already connected
      if (inFrame && !isConnected) {
        const farcasterConnector = connectors.find(
          (connector) => 
            connector.id === "farcaster" || 
            connector.name?.toLowerCase().includes('farcaster') ||
            connector.name?.toLowerCase().includes('miniapp') ||
            connector.uid?.includes('farcaster')
        );
        
        if (farcasterConnector) {
          console.log('Auto-connecting to Farcaster...');
          connect({ connector: farcasterConnector });
        }
      }
    }
  }, [connectors, connect, isConnected]);

  const truncateAddress = (addr: string | undefined) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  const getWalletIcon = () => {
    const sanitizeImageUrl = (url: string) => {
      if (!url) return null;
      try {
        const trimmedUrl = url.trim();
        if (trimmedUrl.startsWith('data:')) {
          return trimmedUrl;
        }
        new URL(trimmedUrl);
        return trimmedUrl;
      } catch {
        return null;
      }
    };

    if (walletInfo?.icon) {
      const sanitizedUrl = sanitizeImageUrl(walletInfo.icon);
      if (sanitizedUrl) {
        return (
          <Image
            src={sanitizedUrl}
            alt={walletInfo.name || "Wallet"}
            width={24}
            height={24}
            className="w-6 h-6 rounded-full"
            onError={() => {}}
            unoptimized
          />
        );
      }
    }

    if (connector?.icon) {
      const sanitizedUrl = sanitizeImageUrl(connector.icon);
      if (sanitizedUrl) {
        return (
          <Image
            src={sanitizedUrl}
            alt={connector.name || "Wallet"}
            width={24}
            height={24}
            className="w-6 h-6 rounded-full"
            onError={() => {}}
            unoptimized
          />
        );
      }
    }

    return <Wallet className="w-6 h-6 text-white" />;
  };

  const getWalletName = () => walletInfo?.name || connector?.name || "Connected Wallet";

  const getChainName = () => {
    // Chain ID mappings
    const chainNames: Record<number, string> = {
      // 84532: "Base Sepolia",      // SUPPORTED_CHAIN_ID (deprecated)
      8453: "Base",
      42161: "Arbitrum One",
      421614: "Arbitrum Sepolia",
      10: "Optimism",
      11155420: "Optimism Sepolia",
      137: "Polygon",
      80002: "Polygon Amoy",
      1: "Ethereum",
      11155111: "Sepolia",
    };
    return chainNames[chainId] || `Chain ${chainId}`;
  };

  const handleConnect = async () => {
    try {
      await open();
    } catch (error: unknown) {
      console.error("Connection error:", error instanceof Error ? error.message : String(error));
    }
  };

  const handleDisconnect = () => {
    setIsDropdownOpen(false);
    try {
      if (appkitIsConnected) {
        appkitDisconnect();
      }
      if (wagmiIsConnected) {
        wagmiDisconnect();
      }
      close();
      router.push("/");
    } catch (error: unknown) {
      console.error("Disconnect error:", error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="flex items-center justify-between py-0 px-3 sm:px-4 md:px-6 lg:px-12 w-full absolute top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-none">
      <div className="flex items-center">
        <Link href="/" className="flex items-center gap-1 sm:gap-2">
          <div className="text-white font-bold text-2xl flex gap-2 items-center my-0 py-0">
            <Image
              src="/Blocxtactoe-logo.png"
              alt="BlOcXTacToe Logo"
              width={80}
              height={80}
              className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain my-0 py-0"
            />
            {/* <span className="text-white font-bold">
              BL<span className="text-orange-500">O</span>C<span className="text-blue-500">X</span>TacToe
            </span> */}
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {!mounted ? (
          <button className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-orange-500 py-1 sm:py-2 px-10 sm:px-4 md:py-3 md:px-10 rounded-lg text-xs sm:text-sm md:text-base cursor-pointer font-medium border border-white/20 transition-all">
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden">Connect</span>
          </button>
        ) : isConnected ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={isSwitchingChain}
              className="flex items-center gap-1 sm:gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 sm:px-3 py-1.5 sm:py-2 md:px-4 md:py-2 hover:bg-white/20 transition-colors text-xs sm:text-sm md:text-base border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSwitchingChain ? (
                <span className="text-orange-500 text-xs">Switching...</span>
              ) : (
                <>
                  <span className="text-orange-500 font-medium hidden sm:inline">{truncateAddress(address)}</span>
                  <span className="text-orange-500 font-medium sm:hidden text-xs">{address ? `${address.slice(0, 4)}...` : ""}</span>
                </>
              )}
              {getWalletIcon()}
              <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-[#1f2937]/95 backdrop-blur-md rounded-lg shadow-xl z-50 border border-white/10">
                <div className="p-3 sm:p-4 border-b border-white/10">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {getWalletIcon()}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm sm:text-base truncate">{getWalletName()}</p>
                      <p className="text-xs sm:text-sm text-gray-400 truncate">{truncateAddress(address)}</p>
                      {chainId && (
                        <p className={`text-xs mt-1 ${chainId === SUPPORTED_CHAIN_ID ? 'text-green-400' : 'text-yellow-400'}`}>
                          {getChainName()}
                          {chainId !== SUPPORTED_CHAIN_ID && !isSwitchingChain && (
                            <span className="ml-1">⚠️</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={handleDisconnect}
                    className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 text-gray-300 hover:bg-white/10 rounded-md transition-colors text-sm sm:text-base"
                  >
                    <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-orange-500 py-1 sm:py-2 px-10 sm:px-4 md:py-3 md:px-10 rounded-lg transition-all text-xs sm:text-sm md:text-base cursor-pointer font-medium border border-white/20"
          >
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden">Connect</span>
          </button>
        )}
      </div>
    </nav>
  );
}

