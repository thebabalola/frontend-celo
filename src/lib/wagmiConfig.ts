// src/lib/wagmiConfig.ts
import { createConfig, http } from "wagmi";
// import { baseSepolia } from "wagmi/chains"; // Base Sepolia - commented out
// import { base } from "wagmi/chains"; // Base Mainnet - commented out
import { celo } from "wagmi/chains"; // Celo Mainnet
import {
  injected,
  walletConnect,
  // metaMask, // commented out to avoid importing MetaMask SDK during build
  coinbaseWallet,
} from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

// Create WalletConnect connector only once
let walletConnectConnector: any = null;

const getWalletConnectConnector = () => {
  if (!walletConnectConnector) {
    walletConnectConnector = walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
      metadata: {
        name: "BlOcXTacToe",
        description: "Decentralized Tic Tac Toe on Celo Mainnet",
        url: "https://blocxtactoe.vercel.app",
        icons: ["https://blocxtactoe.vercel.app/bbt-logo.png"],
      },
    });
  }
  return walletConnectConnector;
};

export const config = createConfig({
  // chains: [baseSepolia], // Base Sepolia - commented out
  // chains: [base], // Base Mainnet - commented out
  chains: [celo], // Celo Mainnet
  transports: {
    [celo.id]: http("https://forno.celo.org", {
      batch: {
        multicall: true,
      },
      retryCount: 3,
      retryDelay: 1000,
    }), // Celo Mainnet RPC with retry logic
  },
  connectors: [
    // Farcaster Mini App connector as the primary option
    farcasterMiniApp(),
    injected({
      target: "metaMask",
    }),
    // metaMask(), // disabled: MetaMask connector pulls @react-native-async-storage which breaks the build
    coinbaseWallet({
      appName: "BlOcXTacToe",
    }),
    getWalletConnectConnector(),
  ],
  ssr: false, // Disable SSR to avoid indexedDB issues
  multiInjectedProviderDiscovery: true,
});
