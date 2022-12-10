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
});
