# veritas-sandbox

> Working smart contract escrow and disbursement demo on Polygon Amoy testnet — simulating legal-financial settlement use cases with real on-chain transactions.

---

## What this demonstrates

1. **Class action disbursement** — USDC held in escrow, released to multiple claimants in a single transaction
2. **Chapter 11 waterfall** — two-tranche priority disbursement, senior class paid before junior
3. **Trustee escrow** — single beneficiary escrow with court-order release condition simulation

All contracts are deployed on Polygon Amoy testnet. No real money involved.

---

## Quick start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your wallet private key and Alchemy API key to .env

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Polygon Amoy testnet
npx hardhat run scripts/deploy.js --network polygonAmoy

# Run the demo disbursement
npx hardhat run scripts/demo-disbursement.js --network polygonAmoy
```

---

## Get testnet funds

1. **Testnet MATIC** (for gas): https://faucet.polygon.technology
2. **Testnet USDC**: https://faucet.circle.com → select "Polygon Amoy"

---

## Contract addresses (Amoy testnet)

| Contract | Address | Etherscan |
|----------|---------|-----------|
| VeritaEscrow | TBD after deploy | TBD |
| MockUSDC | TBD after deploy | TBD |

*Deploy and update this table with your addresses.*

---

## Project structure

```
veritas-sandbox/
├── contracts/
│   ├── VeritaEscrow.sol          # Core escrow contract
│   ├── VeritaWaterfall.sol       # Chapter 11 waterfall disbursement
│   └── MockUSDC.sol              # Test USDC token for local testing
├── scripts/
│   ├── deploy.js                 # Deploy all contracts
│   ├── demo-disbursement.js      # Simulate class action payout
│   └── demo-waterfall.js        # Simulate Chapter 11 waterfall
├── test/
│   ├── VeritaEscrow.test.js     # Escrow contract tests
│   └── VeritaWaterfall.test.js  # Waterfall contract tests
├── frontend/
│   └── index.html               # Simple demo UI
├── hardhat.config.js
├── package.json
└── .env.example
```

---

## Architecture

```
Administrator (Court-Appointed Trustee)
        │
        ▼
  VeritaEscrow.sol
  ┌─────────────────────────────────┐
  │  depositFunds(amount)           │  ← Fund the escrow
  │  registerClaimant(addr, amount) │  ← Add verified claimants
  │  releaseFunds()                 │  ← Trigger disbursement
  │  emergencyWithdraw()            │  ← Admin safety valve
  └─────────────────────────────────┘
        │
        ▼ (USDC transfers)
  Claimant wallets [0x..., 0x..., 0x...]
```

---

## Related

- [`veritas-blockchain`](https://github.com/cmahadeo77/Veritas-blockchain) — Strategic framework and use case documentation
- [Polygon Amoy Explorer](https://amoy.polygonscan.com)
- [Circle USDC Faucet](https://faucet.circle.com)
