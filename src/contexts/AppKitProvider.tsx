'use client'

import { wagmiAdapter, projectId } from '@/lib/appkitConfig'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
// import { baseSepolia } from '@reown/appkit/networks' // Base Sepolia - commented out
import { base } from '@reown/appkit/networks' // Base Mainnet
import React, { type ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

// Set up queryClient
const queryClient = new QueryClient()

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Set up metadata for BlOcXTacToe
const metadata = {
  name: 'BlOcXTacToe',
  description: 'Decentralized Tic Tac Toe on Celo Mainnet',
  url: 'https://blocxtactoe.vercel.app',
  icons: ['https://blocxtactoe.vercel.app/bbt-logo.png']
}

// Create the AppKit modal
const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  // networks: [baseSepolia], // Base Sepolia - commented out
  // networks: [base], // Base Mainnet - commented out
  networks: [celo], // Celo Mainnet
  // defaultNetwork: baseSepolia, // Base Sepolia - commented out
  // defaultNetwork: base, // Base Mainnet - commented out
  defaultNetwork: celo, // Celo Mainnet
  metadata: metadata,
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  }
})

function AppKitProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

export default AppKitProvider
