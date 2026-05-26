# Verita Sandbox — Frontend

React demo app connecting the smart contracts and Stellar Horizon API into a single interactive dashboard.

## Four tabs

| Tab | What it shows |
|-----|---------------|
| **Use Cases** | All 9 use cases with documented pain points, blockchain solutions, and chain recommendations |
| **Class Action Demo** | Step-through simulation of Rodriguez v. MegaCorp — escrow → register → approve → disburse |
| **Chapter 11 Waterfall** | Interactive waterfall with smart contract priority enforcement — try paying a junior tranche before senior |
| **Stellar · Cross-border** | Horizon API payment stream, Stellar vs SWIFT comparison, live payout simulation |

## Run locally

```bash
cd frontend
npm install
npm start
# Opens at http://localhost:3000
```

## With MetaMask (live testnet)

1. Install MetaMask browser extension
2. App will prompt to switch to Polygon Amoy (automatic)
3. Get testnet MATIC: https://faucet.polygon.technology
4. Get testnet USDC: https://faucet.circle.com
5. Set contract addresses in `.env`:

```
REACT_APP_ESCROW_ADDRESS=0x...
REACT_APP_WATERFALL_ADDRESS=0x...
REACT_APP_USDC_ADDRESS=0x...
```

## Without MetaMask

The demo runs in simulation mode automatically — all flows work with mock data and simulated transactions. No wallet required to demonstrate the concepts.

## Deploy to GitHub Pages

```bash
npm run build
# Copy build/ contents to docs/ in repo root
# Enable GitHub Pages from docs/ in repo settings
```
