import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { connectWallet, formatUSDC } from './lib/contracts';
import { MOCK_TRANSACTIONS, getPaymentHistory } from './lib/horizon';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      '#0a0f1a',
  surface: '#111827',
  surface2:'#1a2436',
  border:  '#1f2d42',
  accent:  '#c8a96e',
  green:   '#4ecca3',
  blue:    '#3b82f6',
  warn:    '#f59e0b',
  danger:  '#ef4444',
  text:    '#e8e4dc',
  muted:   '#6b7a8d',
};

const USE_CASES = [
  { id: 'class-action', label: 'Class Action', icon: '⚖', chain: 'Polygon / Arc', status: 'Demo ready', color: C.green, priority: 'High' },
  { id: 'chapter7',    label: 'Chapter 7 Trustee', icon: '🏛', chain: 'Canton', status: 'Prototype', color: C.blue, priority: 'High' },
  { id: 'chapter11',   label: 'Chapter 11 Waterfall', icon: '📊', chain: 'Canton', status: 'Demo ready', color: C.blue, priority: 'High' },
  { id: 'mass-tort',   label: 'Mass Tort (Cross-border)', icon: '🌍', chain: 'Stellar / Tempo', status: 'Research', color: C.accent, priority: 'Medium' },
  { id: 'qsf',         label: 'QSF Custodial', icon: '🔒', chain: 'Arc (USDC)', status: 'Prototype', color: C.accent, priority: 'Medium' },
  { id: 'wage-hour',   label: 'Wage & Hour', icon: '💼', chain: 'Polygon', status: 'Demo ready', color: C.green, priority: 'High' },
  { id: 'structured',  label: 'Structured Settlement', icon: '📅', chain: 'Arc', status: 'Research', color: C.warn, priority: 'Low' },
  { id: 'insurance',   label: 'Insurance Receivership', icon: '🛡', chain: 'Canton', status: 'Research', color: C.warn, priority: 'Low' },
  { id: 'unclaimed',   label: 'Unclaimed Funds Prevention', icon: '🔍', chain: 'Any', status: 'Prototype', color: C.blue, priority: 'Medium' },
];

const MOCK_CLAIMANTS = [
  { id: 'CLM-001', name: 'Maria Rodriguez', amount: 250, wallet: '0x1a2...3b4c', status: 'pending' },
  { id: 'CLM-002', name: 'James Thompson',  amount: 200, wallet: '0x5d6...7e8f', status: 'pending' },
  { id: 'CLM-003', name: 'Sarah Kim',        amount: 150, wallet: '0x9a0...1b2c', status: 'pending' },
  { id: 'CLM-004', name: 'David Liu',        amount: 225, wallet: '0x3d4...5e6f', status: 'pending' },
  { id: 'ALM-005', name: 'Ana Martinez',     amount: 175, wallet: '0x7g8...9h0i', status: 'pending' },
];

const WATERFALL_TRANCHES = [
  { name: 'Senior Secured', type: 'SENIOR_SECURED', claim: 500000, recovery: 100, color: C.green, paid: false },
  { name: 'Admin Claims',   type: 'ADMIN_CLAIMS',   claim: 120000, recovery: 100, color: C.green, paid: false },
  { name: 'Unsecured',      type: 'UNSECURED',      claim: 800000, recovery: 62,  color: C.blue,  paid: false },
  { name: 'Subordinated',   type: 'SUBORDINATED',   claim: 200000, recovery: 0,   color: C.warn,  paid: false },
  { name: 'Equity',         type: 'EQUITY',          claim: 400000, recovery: 0,   color: C.danger,paid: false },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  app: { background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'DM Sans', 'IBM Plex Sans', sans-serif", fontSize: 14 },
  nav: { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 32, height: 56 },
  navBrand: { fontFamily: 'serif', fontSize: 18, color: C.accent, letterSpacing: '-0.5px', marginRight: 8 },
  navTab: (active) => ({ padding: '4px 0', borderBottom: `2px solid ${active ? C.accent : 'transparent'}`, color: active ? C.text : C.muted, cursor: 'pointer', fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'none', border: 'none', borderBottom: `2px solid ${active ? C.accent : 'transparent'}` }),
  main: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 16 },
  badge: (color) => ({ background: `${color}18`, border: `1px solid ${color}44`, color, borderRadius: 4, padding: '2px 10px', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.08em', display: 'inline-block' }),
  btn: (variant = 'primary') => ({
    background: variant === 'primary' ? C.accent : 'transparent',
    color: variant === 'primary' ? '#000' : C.muted,
    border: `1px solid ${variant === 'primary' ? C.accent : C.border}`,
    borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontFamily: 'monospace',
    fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'opacity 0.15s',
  }),
  label: { fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, marginBottom: 6, display: 'block' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  sectionTitle: { fontFamily: 'serif', fontSize: 24, fontWeight: 300, marginBottom: 6, letterSpacing: '-0.5px' },
  muted: { color: C.muted, fontSize: 13, lineHeight: 1.6 },
  mono: { fontFamily: 'monospace', fontSize: 12, color: C.muted },
};

// ── Components ────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ ...s.card, marginBottom: 0 }}>
      <div style={s.label}>{label}</div>
      <div style={{ fontSize: 28, fontFamily: 'serif', fontWeight: 300, color: color || C.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ ...s.muted, marginTop: 4, fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { 'Demo ready': C.green, 'Prototype': C.blue, 'Research': C.warn };
  const color = colors[status] || C.muted;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color, fontFamily: 'monospace', fontSize: 11 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', animation: status === 'Demo ready' ? 'pulse 2s ease-in-out infinite' : 'none' }} />
    {status}
  </span>;
}

// ── Tab: Use Case Map ─────────────────────────────────────────────────────────
function UseCaseMap() {
  const [selected, setSelected] = useState(USE_CASES[0]);
  const painPoints = {
    'class-action': 'June 2025 Senate investigation found administrators routing payouts through prepaid cards with $5.95/month inactivity fees. Estimated $300–400M in settlement funds pocketed by FinTechs instead of claimants.',
    'chapter7': 'Under 11 U.S.C. § 347, trustees must stop payment on checks unpresented within 90 days — funds revert to court. Stale addresses cause structural unclaimed fund accumulation in every large case.',
    'chapter11': '717 corporate bankruptcy filings through Nov 2025 — highest since 2010. Manual waterfall administration at this volume creates systematic delay and error risk.',
    'mass-tort': 'Cross-border mass tort payouts require SWIFT wires: 3–5 days, $25–50/wire, correspondent bank failures, and OFAC delays. Some claimants in unstable banking regions cannot receive wires at all.',
    'qsf': 'QSFs hold mass tort proceeds for years with idle cash earning minimal yield. Funds are commingled. Each distribution requires manual trustee approval per payment.',
    'wage-hour': 'Large wage class actions involve millions of small payments to former employees with stale banking info. Check bounce rates are high; reissuance adds cost and delay.',
    'structured': 'Plan administrators manually trigger periodic payments over 20–30 year periods. Counterparty risk if the annuity issuer fails mid-term.',
    'insurance': 'Multi-year receivership wind-downs manage policyholder claims with manual priority processing, high admin overhead, and stale contact information.',
    'unclaimed': 'Unclaimed funds escheat to state governments when checks go unpresented. Skip tracing and address verification consume significant administration resources.',
  };

  return (
    <div>
      <h2 style={s.sectionTitle}>Nine use cases mapped</h2>
      <p style={{ ...s.muted, marginBottom: 24 }}>Click any use case to see the documented pain point, blockchain solution, and chain recommendation.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {USE_CASES.map(uc => (
          <button key={uc.id} onClick={() => setSelected(uc)} style={{
            background: selected.id === uc.id ? `${uc.color}12` : C.surface,
            border: `1px solid ${selected.id === uc.id ? uc.color : C.border}`,
            borderRadius: 6, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
            borderLeft: `3px solid ${uc.color}`,
          }}>
            <div style={{ fontSize: 16, marginBottom: 4 }}>{uc.icon}</div>
            <div style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{uc.label}</div>
            <div style={{ marginTop: 4 }}><StatusDot status={uc.status} /></div>
          </button>
        ))}
      </div>
      {selected && (
        <div style={{ ...s.card, borderLeft: `3px solid ${selected.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 20, marginRight: 10 }}>{selected.icon}</span>
              <span style={{ fontSize: 18, fontFamily: 'serif', fontWeight: 300 }}>{selected.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={s.badge(selected.color)}>{selected.chain}</span>
              <span style={s.badge(selected.priority === 'High' ? C.green : selected.priority === 'Medium' ? C.blue : C.muted)}>{selected.priority} priority</span>
            </div>
          </div>
          <div style={s.label}>Documented pain point</div>
          <p style={{ ...s.muted, marginBottom: 16 }}>{painPoints[selected.id]}</p>
          <div style={s.label}>Blockchain solution</div>
          <p style={s.muted}>
            {selected.id === 'class-action' && 'USDC directly to claimant wallets via Circle Wallets API — eliminates the prepaid card middleman. Zero inactivity fees. Full disbursement transparency on-chain. Congressional scrutiny makes this a regulatory positioning play.'}
            {selected.id === 'chapter7' && 'On-chain creditor wallet registry + USDC escrow with smart contract release conditions. Assets remain claimable indefinitely — 90-day check presentment window is structurally eliminated.'}
            {selected.id === 'chapter11' && 'Smart contract waterfall enforces priority payment order mathematically. Senior creditors paid before junior creditors — impossible to override, regardless of processing order.'}
            {selected.id === 'mass-tort' && 'Stablecoin payments settle cross-border in seconds on Stellar/Tempo. OFAC screening at smart contract level. Circle off-ramp partners enable local currency conversion anywhere.'}
            {selected.id === 'qsf' && 'USDC-denominated QSF with Circle yield-bearing USDC for idle cash. Per-claimant sub-accounts. Automated release on Valid8-verified claim approval.'}
            {selected.id === 'wage-hour' && 'Email-to-wallet claim flow via Circle Wallets API. Claimants receive USDC without needing crypto knowledge. No stale routing numbers. Instant availability on settlement effective date.'}
            {selected.id === 'structured' && 'Fully automated payment schedule in smart contract. Payments execute on-chain on schedule without administrator intervention. Counterparty risk eliminated — funds held in smart contract, not by annuity issuer.'}
            {selected.id === 'insurance' && 'Smart contract-managed claim reserve with automated priority payments. In-force claims paid first, surrenders second, equity last — enforced in code.'}
            {selected.id === 'unclaimed' && 'On-chain wallet registry replaces mailing address database. Funds remain claimable indefinitely. Escheatment becomes structurally impossible.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Class Action Demo ────────────────────────────────────────────────────
function ClassActionDemo() {
  const [phase, setPhase] = useState('setup'); // setup → funded → registered → approved → disbursed
  const [claimants, setClaimants] = useState(MOCK_CLAIMANTS);
  const [txLog, setTxLog] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);

  const log = (msg, type = 'info') => setTxLog(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString() }]);

  const handleConnect = async () => {
    try {
      const w = await connectWallet();
      setWallet(w);
      log(`Connected: ${w.address.slice(0,6)}...${w.address.slice(-4)}`, 'success');
    } catch (e) {
      log(`Demo mode — MetaMask not detected. Running simulation.`, 'warn');
      setWallet({ address: '0xDEMO...', simulated: true });
    }
  };

  const simulate = async (action, delay = 800) => {
    setLoading(true);
    await new Promise(r => setTimeout(r, delay));
    setLoading(false);
    action();
  };

  const handleFund = () => simulate(() => {
    log('Escrow created: CASE-2025-CLASS-001 · Rodriguez v. MegaCorp', 'success');
    log('$1,000 USDC deposited to escrow contract · TX: 0xabc...123', 'success');
    setPhase('funded');
  });

  const handleRegister = () => simulate(() => {
    claimants.forEach(c => log(`Claimant registered: ${c.name} — $${c.amount} USDC`, 'info'));
    setPhase('registered');
  }, 1200);

  const handleApprove = () => simulate(() => {
    log('Court order confirmation received · Release approved', 'success');
    setPhase('approved');
  });

  const handleDisburse = () => simulate(async () => {
    for (let i = 0; i < claimants.length; i++) {
      await new Promise(r => setTimeout(r, 300));
      setClaimants(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'paid' } : c));
      log(`✓ ${claimants[i].name}: $${claimants[i].amount} USDC · TX: 0x${Math.random().toString(16).slice(2,10)}`, 'success');
    }
    setPhase('disbursed');
  }, 200);

  const total = claimants.reduce((s, c) => s + c.amount, 0);
  const paid = claimants.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);

  const steps = [
    { id: 'setup',      label: '1 · Connect', done: phase !== 'setup' },
    { id: 'funded',     label: '2 · Fund',    done: ['registered','approved','disbursed'].includes(phase) },
    { id: 'registered', label: '3 · Register',done: ['approved','disbursed'].includes(phase) },
    { id: 'approved',   label: '4 · Approve', done: phase === 'disbursed' },
    { id: 'disbursed',  label: '5 · Disburse',done: phase === 'disbursed' },
  ];

  return (
    <div>
      <h2 style={s.sectionTitle}>Class Action Demo</h2>
      <p style={{ ...s.muted, marginBottom: 24 }}>Rodriguez v. MegaCorp · Wage & hour settlement · $1,000 USDC · 5 claimants · Polygon Amoy testnet</p>

      {/* Progress steps */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        {steps.map((step, i) => (
          <div key={step.id} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, background: step.done ? C.green : C.border, height: 3, borderRadius: i === 0 ? '3px 0 0 3px' : i === steps.length - 1 ? '0 3px 3px 0' : 0 }} />
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: step.done ? C.green : C.muted, whiteSpace: 'nowrap', padding: '0 8px' }}>{step.label}</div>
          </div>
        ))}
      </div>

      <div style={s.grid2}>
        {/* Left: action panel */}
        <div>
          <div style={s.card}>
            <div style={s.label}>Escrow controls</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!wallet && (
                <button style={s.btn('primary')} onClick={handleConnect}>Connect Wallet</button>
              )}
              {wallet && phase === 'setup' && (
                <button style={s.btn('primary')} onClick={handleFund} disabled={loading}>
                  {loading ? 'Creating escrow...' : 'Fund Escrow ($1,000 USDC)'}
                </button>
              )}
              {phase === 'funded' && (
                <button style={s.btn('primary')} onClick={handleRegister} disabled={loading}>
                  {loading ? 'Registering...' : 'Register 5 Claimants'}
                </button>
              )}
              {phase === 'registered' && (
                <button style={s.btn('primary')} onClick={handleApprove} disabled={loading}>
                  {loading ? 'Processing...' : 'Approve Release (Court Order)'}
                </button>
              )}
              {phase === 'approved' && (
                <button style={s.btn('primary')} onClick={handleDisburse} disabled={loading}>
                  {loading ? 'Disbursing...' : 'Release Funds to All Claimants'}
                </button>
              )}
              {phase === 'disbursed' && (
                <div style={{ color: C.green, fontFamily: 'monospace', fontSize: 13 }}>
                  ✓ Disbursement complete — {claimants.length} claimants paid
                </div>
              )}
            </div>
          </div>

          {/* Claimant list */}
          <div style={s.card}>
            <div style={s.label}>Claimants</div>
            {claimants.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, color: C.text }}>{c.name}</div>
                  <div style={s.mono}>{c.wallet}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: C.accent, fontFamily: 'monospace' }}>${c.amount}</div>
                  <span style={s.badge(c.status === 'paid' ? C.green : C.muted)}>
                    {c.status === 'paid' ? '✓ paid' : 'pending'}
                  </span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 12 }}>
              <span style={{ color: C.muted }}>Total allocated</span>
              <span style={{ color: C.accent }}>${total} USDC</span>
            </div>
            {paid > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 12, marginTop: 4 }}>
                <span style={{ color: C.muted }}>Disbursed</span>
                <span style={{ color: C.green }}>${paid} USDC</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: transaction log */}
        <div style={{ ...s.card, fontFamily: 'monospace', fontSize: 12, maxHeight: 480, overflowY: 'auto' }}>
          <div style={s.label}>Transaction log</div>
          {txLog.length === 0 && <div style={{ color: C.muted }}>Awaiting first action...</div>}
          {txLog.map((entry, i) => (
            <div key={i} style={{
              color: entry.type === 'success' ? C.green : entry.type === 'warn' ? C.warn : C.muted,
              padding: '4px 0', borderBottom: `1px solid ${C.border}20`
            }}>
              <span style={{ color: C.border, marginRight: 8 }}>{entry.ts}</span>
              {entry.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Chapter 11 Waterfall ─────────────────────────────────────────────────
function WaterfallDemo() {
  const [tranches, setTranches] = useState(WATERFALL_TRANCHES);
  const [availableFunds, setAvailableFunds] = useState(880000);
  const totalClaims = tranches.reduce((s, t) => s + t.claim, 0);

  const payTranche = (idx) => {
    const canPay = tranches.slice(0, idx).every(t => t.recovery === 0 || t.paid);
    if (!canPay) { alert('Cannot pay — higher priority tranches must be paid first.'); return; }
    const tranche = tranches[idx];
    const payout = Math.floor(tranche.claim * tranche.recovery / 100);
    if (payout > availableFunds) { alert('Insufficient funds for this tranche.'); return; }
    setAvailableFunds(prev => prev - payout);
    setTranches(prev => prev.map((t, i) => i === idx ? { ...t, paid: true } : t));
  };

  const chartData = tranches.map(t => ({
    name: t.name.split(' ')[0],
    claim: t.claim / 1000,
    recovery: Math.floor(t.claim * t.recovery / 100) / 1000,
    fill: t.color,
  }));

  return (
    <div>
      <h2 style={s.sectionTitle}>Chapter 11 Waterfall</h2>
      <p style={{ ...s.muted, marginBottom: 24 }}>Acme Corp · Plan effective date: Jan 1 2026 · Total available: ${(availableFunds/1000).toFixed(0)}K USDC · Smart contract enforces priority — junior tranches blocked until senior tranches paid.</p>

      <div style={s.grid2}>
        <div>
          <div style={s.card}>
            <div style={s.label}>Creditor waterfall</div>
            {tranches.map((t, idx) => {
              const payout = Math.floor(t.claim * t.recovery / 100);
              const canPay = tranches.slice(0, idx).every(t => t.recovery === 0 || t.paid);
              return (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 3, height: 40, background: t.color, borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: t.paid ? C.muted : C.text }}>{t.name}</div>
                    <div style={s.mono}>Claim: ${(t.claim/1000).toFixed(0)}K · Recovery: {t.recovery}% · Payout: ${(payout/1000).toFixed(0)}K</div>
                  </div>
                  {t.recovery > 0 && !t.paid && (
                    <button style={{ ...s.btn(canPay ? 'primary' : 'secondary'), opacity: canPay ? 1 : 0.4 }}
                      onClick={() => payTranche(idx)} disabled={!canPay}>
                      Pay
                    </button>
                  )}
                  {t.paid && <span style={s.badge(C.green)}>✓ Paid</span>}
                  {t.recovery === 0 && <span style={s.badge(C.danger)}>Zero recovery</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={s.card}>
            <div style={s.label}>Recovery by tranche ($K USDC)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: 'monospace', fontSize: 12 }}
                  formatter={(v) => [`$${v}K`, '']}
                />
                <Bar dataKey="claim" name="Total Claim" opacity={0.3} radius={[3,3,0,0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
                <Bar dataKey="recovery" name="Actual Recovery" radius={[3,3,0,0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={s.card}>
            <div style={s.label}>Funds remaining in escrow</div>
            <div style={{ fontSize: 28, fontFamily: 'serif', fontWeight: 300, color: availableFunds > 0 ? C.accent : C.muted }}>
              ${(availableFunds / 1000).toFixed(0)}K USDC
            </div>
            <div style={{ marginTop: 8, height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${(availableFunds / 880000) * 100}%`, height: '100%', background: C.accent, borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Stellar / Cross-border ───────────────────────────────────────────────
function StellarDemo() {
  const [txs, setTxs] = useState(MOCK_TRANSACTIONS);
  const [loading, setLoading] = useState(false);
  const [stellarAddress] = useState('GVERITA' + Math.random().toString(36).slice(2,8).toUpperCase() + 'TRUST1A');

  const simulatePayout = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    const newTx = {
      id: Date.now().toString(),
      from: stellarAddress,
      to: 'GCLMNT' + Math.random().toString(36).slice(2,8).toUpperCase(),
      amount: (Math.random() * 400 + 50).toFixed(2),
      asset: 'USDC',
      hash: Math.random().toString(16).slice(2, 18),
      createdAt: new Date().toISOString(),
      status: 'completed',
    };
    setTxs(prev => [newTx, ...prev]);
    setLoading(false);
  };

  return (
    <div>
      <h2 style={s.sectionTitle}>Stellar · Cross-border payouts</h2>
      <p style={{ ...s.muted, marginBottom: 24 }}>UC-05 · Mass tort cross-border disbursements via Stellar Horizon API. 3–5 second settlement. No SWIFT. No correspondent banks. OFAC screening at smart contract level.</p>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.label}>Disbursement account</div>
          <div style={{ ...s.mono, marginBottom: 16, wordBreak: 'break-all', color: C.accent }}>{stellarAddress}</div>
          <div style={s.label}>Network</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <span style={s.badge(C.green)}>Stellar Testnet</span>
            <span style={s.badge(C.blue)}>Horizon API</span>
            <span style={s.badge(C.accent)}>USDC</span>
          </div>
          <button style={s.btn('primary')} onClick={simulatePayout} disabled={loading}>
            {loading ? 'Sending...' : 'Simulate Cross-border Payout'}
          </button>
          <div style={{ marginTop: 20 }}>
            <div style={s.label}>Why Stellar for cross-border</div>
            {[
              ['Settlement time', '3–5 seconds vs 3–5 business days (SWIFT)'],
              ['Cost per payment', '~$0.0001 vs $25–50 (wire)'],
              ['Geographic reach', 'Any country with smartphone access'],
              ['Sanctions screening', 'At smart contract level — pre-payment'],
              ['Local off-ramp', 'Circle, Bitso, MoneyGram, 180+ countries'],
            ].map(([k,v]) => (
              <div key={k} style={{ display: 'flex', gap: 16, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ ...s.mono, minWidth: 140, color: C.muted }}>{k}</div>
                <div style={{ ...s.mono, color: C.green }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={s.card}>
          <div style={s.label}>Payment stream · Horizon API</div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, maxHeight: 420, overflowY: 'auto' }}>
            {txs.map(tx => (
              <div key={tx.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}20` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: C.green }}>✓ {tx.amount} {tx.asset}</span>
                  <span style={{ color: C.muted }}>{new Date(tx.createdAt).toLocaleTimeString()}</span>
                </div>
                <div style={{ color: C.muted }}>To: {tx.to.slice(0, 16)}...</div>
                <div style={{ color: C.border }}>TX: {tx.hash.slice(0, 20)}...</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'usecases',   label: 'Use Cases' },
  { id: 'classaction',label: 'Class Action Demo' },
  { id: 'waterfall',  label: 'Chapter 11 Waterfall' },
  { id: 'stellar',    label: 'Stellar · Cross-border' },
];

export default function App() {
  const [tab, setTab] = useState('usecases');

  return (
    <div style={s.app}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        button:hover { opacity: 0.85; }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      <nav style={s.nav}>
        <span style={s.navBrand}>Verita</span>
        <span style={{ ...s.badge(C.green), fontSize: 10 }}>Blockchain Sandbox</span>
        {TABS.map(t => (
          <button key={t.id} style={s.navTab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', ...s.mono }}>Polygon Amoy · Stellar Testnet</span>
      </nav>

      <main style={s.main}>
        {tab === 'usecases'    && <UseCaseMap />}
        {tab === 'classaction' && <ClassActionDemo />}
        {tab === 'waterfall'   && <WaterfallDemo />}
        {tab === 'stellar'     && <StellarDemo />}
      </main>
    </div>
  );
}
