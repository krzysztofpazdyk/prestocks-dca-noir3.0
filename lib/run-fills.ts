/**
 * RunRecord × RunPrice slots for History.
 * A missing account stays slots=null (legacy). A zero price or zero units is not a fill.
 * predca 3.0 fills take token amounts from RunRecord and the price from RunPrice.
 */

export type RunFillSlot = {
  units: number;
  price: number;
  /** USDC spent on this leg, when RunPrice recorded it. */
  usdc?: number;
};

export type RunFillView = {
  runIndex: string;
  /** null when this run has no RunPrice account (legacy 1:1). */
  slots: Array<RunFillSlot | null> | null;
};

export type FillRun = {
  runIndex: number;
  mints: string[];
  /** RunRecord.amounts / 1e6. Real minted tokens on predca 3.0. */
  tokenAmounts?: number[];
};

export type FillDecoded = {
  mints: Array<{ toBase58(): string } | null | undefined>;
  units?: Array<bigint | number>;
  pricesE6?: Array<bigint | number>;
  prices?: Array<bigint | number>;
  priceDecimals?: Array<number>;
  usdcSpentEach?: bigint | number;
};

function isPriced(dec: FillDecoded): boolean {
  return dec.prices != null || dec.priceDecimals != null || dec.usdcSpentEach != null;
}

export function fillsFor(
  runs: FillRun[],
  decoded: ReadonlyMap<number, FillDecoded | null>,
): RunFillView[] {
  return runs.map((run) => {
    const dec = decoded.get(run.runIndex) ?? null;
    if (!dec) return { runIndex: String(run.runIndex), slots: null };
    const usdc =
      dec.usdcSpentEach != null && Number(dec.usdcSpentEach) > 0
        ? Number(dec.usdcSpentEach) / 1e6
        : undefined;
    const slots = run.mints.map((mint, i) => {
      const decMint = dec.mints[i]?.toBase58();
      if (decMint !== mint) return null;
      let units: number;
      let price: number;
      if (isPriced(dec)) {
        units = Number(run.tokenAmounts?.[i] ?? NaN);
        const rawPx = Number(dec.prices?.[i] ?? 0);
        const decimals = dec.priceDecimals?.[i] ?? 6;
        const scaled =
          Number.isFinite(rawPx) &&
          rawPx > 0 &&
          Number.isInteger(decimals) &&
          decimals >= 0 &&
          decimals <= 18
            ? rawPx / 10 ** decimals
            : NaN;
        price =
          Number.isFinite(scaled) && scaled > 0
            ? scaled
            : usdc != null && units > 0
              ? usdc / units
              : NaN;
      } else {
        units = Number(dec.units?.[i] ?? NaN) / 1e6;
        price = Number(dec.pricesE6?.[i] ?? NaN) / 1e6;
      }
      if (!Number.isFinite(units) || !Number.isFinite(price)) return null;
      if (units <= 0 || price <= 0) return null;
      return usdc != null ? { units, price, usdc } : { units, price };
    });
    return { runIndex: String(run.runIndex), slots };
  });
}
