import { describe, it, expect } from "vitest";
import crypto from "../../utils/crypto";

/*
 * NetKey, AppKey and all the expected data is taken from
 * section 8 Sample data of the Mesh Profile Specification v1.0.1.
 */

describe("crypto test", () => {
  it("should compute k2 salt successfully", () => {
    // Refer to Mesh Profile Specification 8.1.3.
    const expected = "4f90480c1871bfbffd16971f4d8d10b1";
    const computed = crypto.s1("736d6b32").toString();

    expect(computed).toEqual(expected);
  });

  it("should compute k3 salt successfully", () => {
    // Refer to Mesh Profile Specification 8.1.5.
    const expected = "0036443503f195cc8a716e136291c302";
    const computed = crypto.s1("736d6b33").toString();

    expect(computed).toEqual(expected);
  });

  it("should compute k4 salt successfully", () => {
    // Refer to Mesh Profile Specification 8.1.6.
    const expected = "0e9ac1b7cefa66874c97ee54ac5f49be";
    const computed = crypto.s1("736d6b34").toString();

    expect(computed).toEqual(expected);
  });

  it("should compute k2 material successfully", () => {
    // Refer to Mesh Profile Specification 8.1.3.
    const N = "f7a2a44f8e8a8029064f173ddc1e2b00";
    const P = "00";
    const computed = crypto.k2(N, P);
    const expected = {
      NID: "7f",
      encryptionKey: "9f589181a0f50de73c8070c7a6d27f46",
      privacyKey: "4c715bd4a64b938f99b453351653124f",
    };

    expect(computed.NID).toEqual(expected.NID);
    expect(computed.encryptionKey).toEqual(expected.encryptionKey);
    expect(computed.privacyKey).toEqual(expected.privacyKey);
  });

  it("should compute k3 successfully", () => {
    // Refer to Mesh Profile Specification 8.1.5.
    const N = "f7a2a44f8e8a8029064f173ddc1e2b00";
    const expected = "ff046958233db014";
    const computed = crypto.k3(N);

    expect(computed).toEqual(expected);
  });

  it("should compute k4 successfully", () => {
    // Refer to Mesh Profile Specification 8.1.6.
    const N = "3216d1509884b533248541792b877f98";
    const expected = "38";
    const computed = crypto.k4(N);

    expect(computed).toEqual(expected);
  });

  it("should compute AID successfully", () => {
    // Refer to Mesh Profile Specification 8.2.1.
    const N = "63964771734fbd76e3b40519d1d94a48";
    const expected = "26";
    const computed = crypto.k4(N);

    expect(computed).toEqual(expected);
  });

  it("should compute NID, EncryptionKey, and PrivacyKey successfully", () => {
    // Refer to Mesh Profile Specification 8.2.2.
    const N = "7dd7364cd842ad18c17c2b820c84c3d6";
    const P = "00";
    const computed = crypto.k2(N, P);
    const expected = {
      NID: "68",
      encryptionKey: "0953fa93e7caac9638f58820220a398e",
      privacyKey: "8b84eedec100067d670971dd2aa700cf",
    };

    expect(computed.NID).toEqual(expected.NID);
    expect(computed.encryptionKey).toEqual(expected.encryptionKey);
    expect(computed.privacyKey).toEqual(expected.privacyKey);
  });

  it("should compute Network ID successfully", () => {
    // Refer to Mesh Profile Specification 8.2.4.
    const N = "7dd7364cd842ad18c17c2b820c84c3d6";
    const expected = "3ecaff672f673370";
    const computed = crypto.k3(N);

    expect(computed).toEqual(expected);
  });

  it("should compute e successfully", () => {
    const plaintext = "0000000000123456775ed1c7089019ab";
    const key = "cc6ca17b716bcd901fa2dca274caa6f";

    const expected = "a3f1ea8e4ba20277bfcadf11bc92cbaa";
    const computed = crypto.e(plaintext, key);

    expect(computed).toEqual(expected);
  });
});
