// src/lib/appkitConfig.ts
import { cookieStorage, createStorage } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
// import { baseSepolia } from '@reown/appkit/networks' // Base Sepolia - commented out
// import { base } from '@reown/appkit/networks' // Base Mainnet - commented out
import { celo } from '@reown/appkit/networks' // Celo Mainnet

// Get projectId from your existing env variable
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// export const networks = [baseSepolia] // Base Sepolia - commented out
// export const networks = [base] // Base Mainnet - commented out
export const networks = [celo] // Celo Mainnet

// Set up the Wagmi Adapter (Config) for AppKit
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  projectId,
  networks
})

export const config = wagmiAdapter.wagmiConfig
