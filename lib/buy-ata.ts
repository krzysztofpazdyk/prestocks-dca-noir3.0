import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";

/** Legacy transaction packet limit, including the signature slot. */
export const LEGACY_TX_PACKET_BYTES = 1232;

export const SIGNATURE_POLL_INTERVAL_MS = 1500;
export const SIGNATURE_POLL_TIMEOUT_MS = 60_000;

export type BuySubmitPlan = "buy-only" | "combined" | "two-step";

export type SignatureStatusRow = {
  err: unknown;
  confirmationStatus: string | null;
} | null;

/**
 * Timeout that `isUnconfirmedTimeout` already understands.
 * The name and the "was not confirmed" sentence are deliberate: a purchase
 * that was broadcast must stay tracked, and must not be sent again.
 * Do not use this for a token-account transaction. That signature is not the buy.
 */
export class SignatureNotConfirmedError extends Error {
  readonly signature: string;

  constructor(signature: string, timeoutMs: number) {
    super(
      `Transaction was not confirmed in ${timeoutMs}ms. It is unknown if it succeeded or failed. Check signature ${signature} using the Solana Explorer or CLI tools.`,
    );
    this.name = "TransactionExpiredTimeoutError";
    this.signature = signature;
  }
}

export function ownerAtaAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);
}

/** Indexes whose account is absent. `true` means the account already exists. */
export function missingAtaIndexes(exists: ReadonlyArray<boolean>): number[] {
  const missing: number[] = [];
  for (let i = 0; i < exists.length; i++) {
    if (!exists[i]) missing.push(i);
  }
  return missing;
}

/** Idempotent creates for the missing indexes only, in that same order. */
export function ataCreateInstructions(
  owner: PublicKey,
  mints: readonly PublicKey[],
  missingIndexes: readonly number[],
): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];
  for (const index of missingIndexes) {
    const mint = mints[index];
    if (!mint) continue;
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        owner,
        ownerAtaAddress(owner, mint),
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }
  return instructions;
}

export function transactionFromInstructions(
  instructions: readonly TransactionInstruction[],
  feePayer: PublicKey,
  recentBlockhash: string,
): Transaction {
  const tx = new Transaction();
  for (const ix of instructions) tx.add(ix);
  tx.feePayer = feePayer;
  tx.recentBlockhash = recentBlockhash;
  return tx;
}

/** Token-account creates first, then the purchase. One fee payer, one signature. */
export function assembleBuyTransaction(
  ataInstructions: readonly TransactionInstruction[],
  buyInstruction: TransactionInstruction,
  feePayer: PublicKey,
  recentBlockhash: string,
): Transaction {
  return transactionFromInstructions(
    [...ataInstructions, buyInstruction],
    feePayer,
    recentBlockhash,
  );
}

/** Byte length the cluster will accept or reject. Includes the signature slot. */
export function legacyPacketBytes(tx: Transaction): number {
  return tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).length;
}

/**
 * One signature when every missing account fits in front of the purchase.
 * Otherwise the accounts go out first and the purchase waits for them.
 */
export function chooseBuySubmit(
  missingCount: number,
  serializedBytes: number,
): BuySubmitPlan {
  if (missingCount <= 0) return "buy-only";
  if (
    Number.isFinite(serializedBytes) &&
    serializedBytes > 0 &&
    serializedBytes <= LEGACY_TX_PACKET_BYTES
  ) {
    return "combined";
  }
  return "two-step";
}

export function classifySignatureRow(
  row: SignatureStatusRow,
): "pending" | "confirmed" | "failed" {
  if (row == null) return "pending";
  if (row.err) return "failed";
  if (
    row.confirmationStatus === "confirmed" ||
    row.confirmationStatus === "finalized"
  ) {
    return "confirmed";
  }
  return "pending";
}

export function signatureFailedError(signature: string): Error {
  return new Error(`Transakcja odrzucona przez Devnet. ${signature}`);
}

export type SignaturePollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

/**
 * Confirm without a websocket. `getStatuses` is `getSignatureStatuses`.
 * Throws `SignatureNotConfirmedError` when the limit passes, or the
 * Devnet rejection text when the signature landed with an error.
 */
export async function confirmSignatureByPolling(
  getStatuses: (signature: string) => Promise<ReadonlyArray<SignatureStatusRow>>,
  signature: string,
  options: SignaturePollOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? SIGNATURE_POLL_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? SIGNATURE_POLL_INTERVAL_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const started = now();
  for (;;) {
    const rows = await getStatuses(signature);
    const kind = classifySignatureRow(rows[0] ?? null);
    if (kind === "confirmed") return;
    if (kind === "failed") throw signatureFailedError(signature);
    const elapsed = now() - started;
    if (elapsed >= timeoutMs) {
      throw new SignatureNotConfirmedError(signature, timeoutMs);
    }
    const wait = Math.min(intervalMs, timeoutMs - elapsed);
    await sleep(wait);
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
