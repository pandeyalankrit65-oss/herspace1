import { describe, expect, test } from "vitest";
import {
  createRecordKeys,
  decryptBytes,
  decryptJson,
  encryptBytes,
  encryptJson,
  makeRecoveryCode,
  normaliseRecovery,
  pinIsStrongEnough,
  proofFor,
  rewrapForPin,
  unwrapRecordKey,
} from "./recordCrypto";

describe("private record encryption", () => {
  test("entries encrypted with the record key open again only with the right PIN", async () => {
    const keys = await createRecordKeys("482916");
    const sealed = await encryptJson(keys.key, { what: "He pushed me against the wall", when: "2026-10-08" });
    expect(sealed.ciphertext).not.toContain("pushed");

    const { key } = await unwrapRecordKey("482916", keys.byPin.salt, keys.byPin.wrappedKey);
    expect(await decryptJson(key, sealed)).toEqual({ what: "He pushed me against the wall", when: "2026-10-08" });
    await expect(unwrapRecordKey("482917", keys.byPin.salt, keys.byPin.wrappedKey)).rejects.toThrow();
  }, 30_000);

  test("the proof the server checks matches only the same PIN, and isn't the wrapping key", async () => {
    const keys = await createRecordKeys("482916");
    expect(await proofFor("482916", keys.byPin.salt)).toBe(keys.byPin.proof);
    expect(await proofFor("000000", keys.byPin.salt)).not.toBe(keys.byPin.proof);
  }, 30_000);

  test("the recovery code opens the same record, and a new PIN can be set", async () => {
    const keys = await createRecordKeys("482916");
    const photo = new Uint8Array([1, 2, 3, 250]);
    const sealedPhoto = await encryptBytes(keys.key, photo);

    // Typed in lower case with spaces: still works.
    const typed = keys.recoveryCode.toLowerCase().replace(/-/g, " ");
    const recovered = await unwrapRecordKey(normaliseRecovery(typed), keys.byRecovery.salt, keys.byRecovery.wrappedKey);
    expect(await decryptBytes(recovered.key, sealedPhoto.iv, sealedPhoto.bytes)).toEqual(photo);

    const newPin = await rewrapForPin("731905", recovered.rawKey);
    const reopened = await unwrapRecordKey("731905", newPin.salt, newPin.wrappedKey);
    expect(await decryptBytes(reopened.key, sealedPhoto.iv, sealedPhoto.bytes)).toEqual(photo);
  }, 60_000);

  test("a large photo round-trips", async () => {
    const keys = await createRecordKeys("482916");
    const big = new Uint8Array(3_000_000).map((_, i) => i % 251);
    const sealed = await encryptBytes(keys.key, big);
    expect(await decryptBytes(keys.key, sealed.iv, sealed.bytes)).toEqual(big);
  }, 30_000);

  test("recovery codes are easy to write down", () => {
    const code = makeRecoveryCode();
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){4}$/);
    expect(makeRecoveryCode()).not.toBe(code);
  });

  test("a PIN needs 6 digits, or a passphrase 8 characters", () => {
    expect(pinIsStrongEnough("1234")).toBe(false);
    expect(pinIsStrongEnough("123456")).toBe(true);
    expect(pinIsStrongEnough("red kite")).toBe(true);
    expect(pinIsStrongEnough("kite")).toBe(false);
  });
});
