/**
 * horizon.js
 * Stellar Horizon API integration for cross-border payment tracking.
 *
 * Used in Verita context for:
 * - UC-05: Mass tort cross-border payouts via stablecoin
 * - Monitoring USDC payment status across Stellar network
 * - Streaming real-time payment events to the frontend
 */

import * as StellarSdk from '@stellar/stellar-sdk';

// Testnet for demo — swap to mainnet for production
const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const TESTNET_NETWORK = StellarSdk.Networks.TESTNET;

// USDC asset on Stellar testnet (Circle's test issuer)
const USDC_TESTNET = new StellarSdk.Asset(
  'USDC',
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
);

/**
 * Create a new Stellar keypair (simulates creating a claimant wallet)
 */
export function generateKeypair() {
  const keypair = StellarSdk.Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}

/**
 * Fund a testnet account via Friendbot
 * In production: Circle Wallets API creates and funds custodial accounts
 */
export async function fundTestnetAccount(publicKey) {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
  );
  const data = await response.json();
  return data;
}

/**
 * Get account balance including USDC
 */
export async function getAccountBalance(publicKey) {
  try {
    const account = await server.loadAccount(publicKey);
    const balances = account.balances.map(b => ({
      asset: b.asset_type === 'native' ? 'XLM' : `${b.asset_code}`,
      balance: parseFloat(b.balance).toFixed(2),
      assetCode: b.asset_type === 'native' ? 'XLM' : b.asset_code,
      assetIssuer: b.asset_issuer || null,
    }));
    return balances;
  } catch (e) {
    if (e.response?.status === 404) return null; // Account not funded yet
    throw e;
  }
}

/**
 * Send USDC payment on Stellar
 * Simulates Verita trustee disbursing settlement funds to a claimant
 */
export async function sendUSDCPayment({
  senderSecretKey,
  recipientPublicKey,
  amount,
  memo = '',
}) {
  const senderKeypair = StellarSdk.Keypair.fromSecret(senderSecretKey);
  const senderAccount = await server.loadAccount(senderKeypair.publicKey());

  // Add USDC trustline for recipient if needed (handled by Circle Wallets in prod)
  const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: TESTNET_NETWORK,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: recipientPublicKey,
        asset: USDC_TESTNET,
        amount: amount.toString(),
      })
    )
    .addMemo(StellarSdk.Memo.text(memo.slice(0, 28))) // Stellar memo max 28 chars
    .setTimeout(30)
    .build();

  transaction.sign(senderKeypair);

  const result = await server.submitTransaction(transaction);
  return {
    hash: result.hash,
    ledger: result.ledger,
    envelopeXdr: result.envelope_xdr,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${result.hash}`,
  };
}

/**
 * Batch disbursement — send USDC to multiple claimants
 * Each payment is a separate transaction (Stellar doesn't support true batch)
 * In production, use Stellar's fee bump transactions to reduce cost
 */
export async function batchDisbursement({ senderSecretKey, claimants, caseId }) {
  const results = [];

  for (const claimant of claimants) {
    try {
      const result = await sendUSDCPayment({
        senderSecretKey,
        recipientPublicKey: claimant.walletAddress,
        amount: claimant.amount,
        memo: `${caseId}-${claimant.claimId}`.slice(0, 28),
      });
      results.push({
        claimId: claimant.claimId,
        name: claimant.name,
        amount: claimant.amount,
        status: 'completed',
        hash: result.hash,
        explorerUrl: result.explorerUrl,
      });
    } catch (e) {
      results.push({
        claimId: claimant.claimId,
        name: claimant.name,
        amount: claimant.amount,
        status: 'failed',
        error: e.message,
      });
    }
  }

  return results;
}

/**
 * Stream real-time payments to an account
 * Used in frontend to show live disbursement progress
 */
export function streamPayments(publicKey, onPayment, onError) {
  const closeStream = server
    .payments()
    .forAccount(publicKey)
    .cursor('now')
    .stream({
      onmessage: (payment) => {
        if (payment.type !== 'payment') return;
        onPayment({
          id: payment.id,
          from: payment.from,
          to: payment.to,
          amount: payment.amount,
          asset: payment.asset_code || 'XLM',
          hash: payment.transaction_hash,
          createdAt: payment.created_at,
        });
      },
      onerror: onError,
    });

  return closeStream; // Call to stop streaming
}

/**
 * Get payment history for an account
 * Used to verify disbursement was received
 */
export async function getPaymentHistory(publicKey, limit = 20) {
  const payments = await server
    .payments()
    .forAccount(publicKey)
    .limit(limit)
    .order('desc')
    .call();

  return payments.records
    .filter(p => p.type === 'payment')
    .map(p => ({
      id: p.id,
      type: p.type,
      from: p.from,
      to: p.to,
      amount: p.amount,
      asset: p.asset_code || 'XLM',
      hash: p.transaction_hash,
      createdAt: p.created_at,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${p.transaction_hash}`,
    }));
}

/**
 * Mock data for demo when not connected to testnet
 */
export const MOCK_TRANSACTIONS = [
  { id: '1', from: 'GVERITA...TRUST', to: 'GCLMNT...001', amount: '250.00', asset: 'USDC', hash: 'abc123', createdAt: new Date().toISOString(), status: 'completed' },
  { id: '2', from: 'GVERITA...TRUST', to: 'GCLMNT...002', amount: '200.00', asset: 'USDC', hash: 'def456', createdAt: new Date().toISOString(), status: 'completed' },
  { id: '3', from: 'GVERITA...TRUST', to: 'GCLMNT...003', amount: '150.00', asset: 'USDC', hash: 'ghi789', createdAt: new Date().toISOString(), status: 'completed' },
  { id: '4', from: 'GVERITA...TRUST', to: 'GCLMNT...004', amount: '225.00', asset: 'USDC', hash: 'jkl012', createdAt: new Date().toISOString(), status: 'completed' },
  { id: '5', from: 'GVERITA...TRUST', to: 'GCLMNT...005', amount: '175.00', asset: 'USDC', hash: 'mno345', createdAt: new Date().toISOString(), status: 'completed' },
];
