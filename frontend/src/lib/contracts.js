/**
 * contracts.js
 * ethers.js integration for VeritaEscrow and VeritaWaterfall contracts.
 * Connects React frontend to Polygon Amoy testnet via MetaMask.
 */

import { ethers } from 'ethers';

// ABI — key functions only for frontend interaction
export const ESCROW_ABI = [
  "function createEscrow(string caseId, string caseType, address administrator) returns (uint256)",
  "function depositFunds(uint256 escrowId, uint256 amount)",
  "function registerClaimant(uint256 escrowId, address wallet, uint256 amount, string claimId)",
  "function approveRelease(uint256 escrowId)",
  "function releaseFunds(uint256 escrowId)",
  "function getEscrowSummary(uint256 escrowId) view returns (string,string,uint256,uint256,uint256,uint8,bool)",
  "function getClaimant(uint256 escrowId, uint256 index) view returns (address,uint256,bool,string)",
  "function escrowCount() view returns (uint256)",
  "event FundsDeposited(uint256 indexed escrowId, uint256 amount, address depositor)",
  "event FundsDisbursed(uint256 indexed escrowId, uint256 claimantCount, uint256 totalPaid)",
  "event SinglePayment(uint256 indexed escrowId, address claimant, uint256 amount, string claimId)",
];

export const WATERFALL_ABI = [
  "function createCase(string caseId, string debtorName, address administrator) returns (uint256)",
  "function addTranche(uint256 caseId, uint8 trancheType, string description)",
  "function addCreditor(uint256 caseId, uint256 trancheIndex, address wallet, uint256 claimAmount, string creditorId)",
  "function depositFunds(uint256 caseId, uint256 amount)",
  "function confirmTranche(uint256 caseId, uint256 trancheIndex, uint256 recoveryPct)",
  "function payTranche(uint256 caseId, uint256 trancheIndex)",
  "function getCaseSummary(uint256 caseId) view returns (string,uint256,uint256)",
  "event TranchePaid(uint256 indexed caseId, uint256 trancheIndex, uint256 totalPaid)",
  "event CreditorPaid(uint256 indexed caseId, string creditorId, address wallet, uint256 amount)",
];

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// Polygon Amoy testnet chain ID
export const AMOY_CHAIN_ID = 80002;

export const AMOY_NETWORK = {
  chainId: '0x13882',
  chainName: 'Polygon Amoy Testnet',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: ['https://rpc-amoy.polygon.technology'],
  blockExplorerUrls: ['https://amoy.polygonscan.com'],
};

/**
 * Connect MetaMask and switch to Polygon Amoy
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('MetaMask not found. Install MetaMask to use this demo.');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);

  // Switch to Polygon Amoy if needed
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(AMOY_CHAIN_ID)) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [AMOY_NETWORK],
        });
      }
    }
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

/**
 * Get contract instances
 */
export function getContracts(signer, addresses) {
  return {
    escrow: new ethers.Contract(addresses.escrow, ESCROW_ABI, signer),
    waterfall: new ethers.Contract(addresses.waterfall, WATERFALL_ABI, signer),
    usdc: new ethers.Contract(addresses.usdc, ERC20_ABI, signer),
  };
}

/**
 * Format USDC amount (6 decimals)
 */
export function formatUSDC(amount) {
  return parseFloat(ethers.formatUnits(amount, 6)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseUSDC(amount) {
  return ethers.parseUnits(amount.toString(), 6);
}
