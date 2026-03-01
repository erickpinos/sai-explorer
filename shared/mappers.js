export function mapTradeRow(row) {
  return {
    id: row.id,
    tradeChangeType: row.trade_change_type,
    realizedPnlPct: row.realized_pnl_pct,
    realizedPnlCollateral: row.realized_pnl_collateral,
    txHash: row.tx_hash,
    evmTxHash: row.evm_tx_hash,
    collateralPrice: row.collateral_price,
    block: {
      block: row.block_height,
      block_ts: row.block_ts,
    },
    trade: {
      id: row.id,
      trader: row.trader,
      evmTrader: row.evm_trader,
      tradeType: row.trade_type,
      isLong: row.is_long,
      isOpen: row.is_open,
      leverage: row.leverage,
      openPrice: row.open_price,
      closePrice: row.close_price,
      collateralAmount: row.collateral_amount,
      openCollateralAmount: row.open_collateral_amount,
      tp: row.tp,
      sl: row.sl,
      perpBorrowing: {
        marketId: row.market_id,
        baseToken: { symbol: row.base_token_symbol },
        collateralToken: { symbol: row.collateral_token_symbol },
      },
    },
  };
}
