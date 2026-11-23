# Status - Veritas-blockchain

_Last reviewed: 2026-11-23_

Smart-contract escrow and waterfall-disbursement sandbox simulating legal-financial settlement (class action, Chapter 11, trustee escrow).

## Components

| Component | State | Notes |
|---|---|---|
| VeritaEscrow.sol | Written | Multi-claimant escrow release |
| VeritaWaterfall.sol | Written | Two-tranche senior/junior priority disbursement |
| scripts/demo-disbursement.js | Written | Demo runner |
| Frontend (React) | Scaffolded | `App.js`, contract + Horizon helpers |
| Testnet deployment | Not started | Contract address table in README is still TBD |
| MockUSDC.sol | Written | 6-decimal test token, owner mint |
| Tests | 14 passing | `test/VeritaEscrow.test.js`, `test/VeritaWaterfall.test.js` (`npx hardhat test`) |

## Known gaps

- README still references `scripts/deploy.js` and `scripts/demo-waterfall.js`, which are not in the repo.
- Access-control and withdrawal bugs found while testing; see M1.5 in the roadmap.
- Contract addresses table still TBD.

## Next up

Finish M1 (deploy + waterfall scripts), then **M1.5 - Contract fixes** in [ROADMAP.md](ROADMAP.md).
