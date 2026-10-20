# Status - Veritas-blockchain

_Last reviewed: 2026-10-20_

Smart-contract escrow and waterfall-disbursement sandbox simulating legal-financial settlement (class action, Chapter 11, trustee escrow).

## Components

| Component | State | Notes |
|---|---|---|
| VeritaEscrow.sol | Written | Multi-claimant escrow release |
| VeritaWaterfall.sol | Written | Two-tranche senior/junior priority disbursement |
| scripts/demo-disbursement.js | Written | Demo runner |
| Frontend (React) | Scaffolded | `App.js`, contract + Horizon helpers |
| Testnet deployment | Not started | Contract address table in README is still TBD |
| Tests | Missing | README references test files not yet committed |

## Known gaps

- README references `scripts/deploy.js`, `contracts/MockUSDC.sol`, `scripts/demo-waterfall.js`, and `test/*.test.js` which are not in the repo.
- Contract addresses table still TBD.

## Next up

See **M1 - Make the README true** in [ROADMAP.md](ROADMAP.md).
