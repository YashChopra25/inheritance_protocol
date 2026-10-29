import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";
import {
  deriveRecipientKeypair,
  encodePublicKey,
  MAX_DOCUMENT_BYTES,
  sealedRecipients,
  sealFile,
  unsealFile,
} from "@/lib/crypto";

const ed = nacl.sign.keyPair();
const deterministic = async (m: Uint8Array) => nacl.sign.detached(m, ed.secretKey);

function textFile(text: string, name = "will.txt") {
  return new File([new TextEncoder().encode(text)], name, { type: "text/plain" });
}

describe("document sealing", () => {
  it("derives the same key from the same wallet", async () => {
    const a = await deriveRecipientKeypair(deterministic);
    const b = await deriveRecipientKeypair(deterministic, { verifyDeterministic: true });
    expect(encodePublicKey(a.publicKey)).toBe(encodePublicKey(b.publicKey));
  });

  it("refuses a wallet that signs non-deterministically", async () => {
    let n = 0;
    const flaky = async (m: Uint8Array) => {
      const sig = nacl.sign.detached(m, ed.secretKey);
      sig[0] ^= ++n;
      return sig;
    };
    await expect(
      deriveRecipientKeypair(flaky, { verifyDeterministic: true })
    ).rejects.toThrow(/different signature each time/);
  });

  it("round-trips for every recipient and records their keys", async () => {
    const owner = await deriveRecipientKeypair(deterministic);
    const heir = nacl.box.keyPair();
    const container = await sealFile(textFile("hello heirs"), [
      { wallet: "OWNER", encryptionPublicKey: owner.publicKey },
      { wallet: "HEIR", encryptionPublicKey: heir.publicKey },
    ]);

    expect(sealedRecipients(container)).toEqual([
      { wallet: "OWNER", publicKey: encodePublicKey(owner.publicKey) },
      { wallet: "HEIR", publicKey: encodePublicKey(heir.publicKey) },
    ]);
    for (const [identity, wallet] of [
      [owner, "OWNER"],
      [heir, "HEIR"],
    ] as const) {
      const out = await unsealFile(container, identity, wallet);
      expect(new TextDecoder().decode(out.bytes)).toBe("hello heirs");
      expect(out.name).toBe("will.txt");
      expect(out.mime).toBe("text/plain");
    }
  });

  it("tells a recipient whose wallet now derives a different key", async () => {
    const heir = nacl.box.keyPair();
    const container = await sealFile(textFile("x"), [
      { wallet: "HEIR", encryptionPublicKey: heir.publicKey },
    ]);
    await expect(unsealFile(container, nacl.box.keyPair(), "HEIR")).rejects.toThrow(
      /now produces a different document key/
    );
    await expect(unsealFile(container, nacl.box.keyPair(), "STRANGER")).rejects.toThrow(
      /not sealed to your wallet/
    );
  });

  it("detects tampering with the ciphertext", async () => {
    const heir = nacl.box.keyPair();
    const container = await sealFile(textFile("x"), [
      { wallet: "HEIR", encryptionPublicKey: heir.publicKey },
    ]);
    container[container.length - 1] ^= 1;
    await expect(unsealFile(container, heir, "HEIR")).rejects.toThrow();
  });

  it("refuses oversized documents before encrypting", async () => {
    const big = { size: MAX_DOCUMENT_BYTES + 1, name: "big.bin", type: "" } as File;
    await expect(
      sealFile(big, [{ wallet: "W", encryptionPublicKey: nacl.box.keyPair().publicKey }])
    ).rejects.toThrow(/too large/);
  });
});
