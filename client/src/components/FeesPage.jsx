function ComingSoonSection({ title, description, fields }) {
  return (
    <div className="methodology-section" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className="badge badge-yellow">Coming Soon</span>
      </div>
      {description && <p style={{ margin: '0 0 0.75rem', color: 'var(--text-secondary, #888)' }}>{description}</p>}
      {fields && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {fields.map(f => (
            <span key={f} style={{
              background: 'var(--bg-secondary, #1a1a2e)',
              border: '1px solid var(--border, #333)',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '0.78rem',
              color: 'var(--text-secondary, #888)',
              fontFamily: 'monospace',
            }}>{f}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeesPage() {
  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Fee Analytics</h2>
        <p style={{ color: 'var(--text-secondary, #888)', margin: 0 }}>
          The fee data API is not yet available on the Sai keeper. Sections below will be populated once the endpoints are live.
        </p>
      </div>

      <ComingSoonSection
        title="Protocol Fee Summary"
        description="All-time protocol-wide fee totals including opening, closing, governance, vault, referrer, and trigger fees."
        fields={['totalFees', 'totalOpeningFees', 'totalClosingFees', 'totalGovFees', 'totalVaultFees', 'totalReferrerFees', 'totalTriggerFees', 'uniqueTraders', 'avgFeeMultiplier']}
      />

      <ComingSoonSection
        title="Daily Fee Analytics"
        description="Daily aggregated fee statistics broken down by collateral token, with opening vs closing counts and amounts."
        fields={['date', 'collateralDenom', 'openingCount', 'openingTotal', 'closingCount', 'closingTotal', 'totalFeesAll', 'avgFeeMultiplier', 'totalBadDebt']}
      />

      <ComingSoonSection
        title="Daily Fee Stats"
        description="Detailed daily stats including per-category breakdowns for governance, vault, referrer, and trigger fees."
        fields={['openingGovFee', 'openingVaultFee', 'openingReferrerFee', 'closingGovFee', 'closingVaultFee', 'closingReferrerFee', 'closingTriggerFee']}
      />

      <ComingSoonSection
        title="Fee Transactions"
        description="Per-transaction fee records with full breakdown: total fee charged, fee multiplier, referrer allocation, and bad debt."
        fields={['id', 'traderAddress', 'feeType', 'totalFeeCharged', 'govFee', 'vaultFee', 'referrerAllocation', 'triggerFee', 'feeMultiplier', 'badDebt', 'blockTime']}
      />

      <ComingSoonSection
        title="Trader Fee Summary"
        description="Per-trader fee totals over any time period, including referrer allocations and average fee multiplier."
        fields={['traderAddress', 'totalFees', 'totalOpeningFees', 'totalClosingFees', 'totalReferrerAllocation', 'openingCount', 'closingCount', 'avgFeeMultiplier']}
      />
    </div>
  );
}
