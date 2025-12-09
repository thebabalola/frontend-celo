# **BlOcX**TacToe 🎮 – Frontend (Celo)

A fully decentralized, peer-to-peer Tic Tac Toe game built on Celo blockchain with native token betting functionality. Players can create games, join existing games, and compete for rewards in a trustless, onchain environment.

> **Note:** This is the Celo deployment of BlOcXTacToe. For the Base deployment, see the main repository.

## ✨ Features

✅ **Implemented:**
- ✅ Game lobby with all available games
- ✅ Interactive 3x3 game board with beautiful UI
- ✅ Real-time game state reads (contract view calls)
- ✅ Wallet connection using Reown (WalletConnect/MetaMask)
- ✅ Transaction signing for create/join/play
- ✅ Responsive design for mobile and desktop
- ✅ Beautiful modern UI with gradients and animations

## 🧰 Tech Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4
- Ethers.js v6 (contract interaction)
- Reown AppKit (WalletConnect/MetaMask)
- Wagmi & Viem
- React Toastify (notifications)

## 🏗️ Architecture

- **Framework:** Next.js 16 with React 19
- **Styling:** Tailwind CSS 4 with custom gradients
- **Wallet Integration:** Reown AppKit (supports MetaMask, WalletConnect, and social logins)
- **Contract Interaction:** Ethers.js v6 via Wagmi adapter
- **Key Components:**
  - `GameBoard` - Interactive 3x3 grid with hover effects
  - `GamesList` - Display all available games
  - `PlayGame` - Individual game interaction page
  - `CreateGame` - Create new game with bet amount

## 🎮 How to Play

1. **Connect Wallet:** Connect your Ethereum wallet using Reown AppKit
2. **Create Game:** Set a bet amount and create a new game
3. **Join Game:** Find an open game and join it
4. **Play:** Take turns making moves on the 3x3 board
5. **Win:** Get three in a row to win both players' ETH!

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- Ethereum wallet for testing (MetaMask recommended)
- Sepolia testnet ETH for transactions

### Installation

```bash
# Navigate to frontend directory
cd BlOcXTacToe-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Reown AppKit Project ID (Get from https://cloud.reown.com)
NEXT_PUBLIC_PROJECT_ID=a9fbadc760baa309220363ec867b732e

# Smart Contract Address (Replace with your deployed contract)
NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
```

## 🔗 Contract Integration

The frontend expects the following contract interface:

**Read Functions:**
- `getGame(uint256 gameId)` - Returns game data
- `getGameBoard(uint256 gameId)` - Returns the current board state
- `getAllGames()` - Returns array of all game IDs

**Write Functions:**
- `createGame(uint256 betAmount)` - Create a new game
- `joinGame(uint256 gameId)` - Join an existing game
- `makeMove(uint256 gameId, uint256 position)` - Make a move

**Events:**
- `GameCreated(uint256 indexed gameId, address indexed player1, uint256 betAmount)`
- `GameJoined(uint256 indexed gameId, address indexed player2)`
- `MoveMade(uint256 indexed gameId, address indexed player, uint256 position)`
- `GameFinished(uint256 indexed gameId, address indexed winner)`

The contract ABI is defined in `src/hooks/useGame.ts`. Update it to match your contract's actual ABI.

## 📁 Project Structure

```
BlOcXTacToe-frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home page
│   │   ├── games/page.tsx        # Games list page
│   │   ├── create/page.tsx       # Create game page
│   │   ├── play/[gameId]/page.tsx # Play game page
│   │   ├── layout.tsx            # Root layout with providers
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   ├── Navbar.tsx            # Navigation bar with wallet connection
│   │   ├── GameBoard.tsx         # Interactive 3x3 game board
│   │   └── GamesList.tsx         # Games list component
│   ├── context/
│   │   ├── appkit.tsx            # Reown AppKit setup
│   │   └── providers.tsx         # React providers wrapper
│   ├── config/
│   │   ├── wagmi.ts              # Wagmi configuration
│   │   └── adapter.ts            # Ethers.js adapter for Wagmi
│   ├── hooks/
│   │   └── useGame.ts            # Game contract interaction hook
│   └── lib/
│       └── utils.ts             # Utility functions (cn, etc.)
├── public/                      # Static assets
├── package.json                 # Dependencies
├── tsconfig.json               # TypeScript config
└── next.config.ts              # Next.js config
```

## 🧪 Scripts

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Lint
```

## 🤝 Contributing

- Fork → feature branch → PR
- Include screenshots for UI changes
- Ensure type‑safety and pass linting

## 📄 License

MIT
