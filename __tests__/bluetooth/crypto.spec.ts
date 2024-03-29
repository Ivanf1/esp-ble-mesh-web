import { describe, it, expect } from "vitest";
import crypto, {
  AuthenticatedEncryptedAccessPayload,
  AuthenticatedEncryptedNetworkPayload,
  EncryptedProvisioningData,
} from "../../src/bluetooth/crypto";

describe("crypto test", () => {
  describe("encryption functions test", () => {
    /*
     * NetKey, AppKey and all the expected data is taken from
     * section 8 Sample data of the Mesh Profile Specification v1.0.1.
     */
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

    it("should compute k1 successfully", () => {
      const N = "3216d1509884b533248541792b877f98";
      const salt = "2ba14ffa0df84a2831938d57d276cab4";
      const P = "5a09d60797eeb4478aada59db3352a0d";

      const expected = "f6ed15a8934afbe7d83e8dcb57fcf5d7";
      const computed = crypto.k1(N, P, salt);

      expect(computed).toEqual(expected);
    });
    it("should compute confirmation key", () => {
      const confirmationSalt = "5faabe187337c71cc6c973369dcaa79a";
      const secret = "ab85843a2f6d883f62e5684b38e307335fe6e1945ecd19604105c6f23221eb69";

      const expected = "e31fe046c68ec339c425fc6629f0336f";
      const computed = crypto.k1(secret, "7072636b", confirmationSalt);

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

    it("should compute privacy random successfully", () => {
      const encDst = "64c1";
      const encTransportPdu = "e3fa2f660b0bf379f3";
      const netmic = "16b8531c";

      const expected = "64c1e3fa2f660b";
      const computed = crypto.privacyRandom(encDst, encTransportPdu, netmic);

      expect(computed).toEqual(expected);
    });
  });

  describe("payload encryption and obfuscation test", () => {
    it("should authenticate and encrypt access payload correctly", () => {
      const appKey = "25170983bf8af3f02c3a44888db053ee";
      const applicationNonce = "01000000060008c00000000000";
      const applicationPayload = "82030006";

      const expected: AuthenticatedEncryptedAccessPayload = {
        EncAccessPayload: "7cd85c77",
        TransMIC: "f5097c1e",
      };

      const computed = crypto.authenticateEncryptAccessPayload(
        appKey,
        applicationNonce,
        applicationPayload
      );

      expect(computed.EncAccessPayload).toEqual(expected.EncAccessPayload);
      expect(computed.TransMIC).toEqual(expected.TransMIC);
    });

    it("should authenticate and encrypt network payload correctly", () => {
      const encryptionKey = "e938e63380d9b1473f2b4b7b0aa8b002";
      const nonce = "00070000060008000000000000";
      const dst = "c000";
      const lowerTransportPDU = "797cd85c77f5097c1e";

      const expected: AuthenticatedEncryptedNetworkPayload = {
        EncryptionKey: encryptionKey,
        EncDST: "64c1",
        EncTransportPDU: "e3fa2f660b0bf379f3",
        NetMIC: "16b8531c",
      };

      const computed = crypto.authenticateEncryptNetworkPayload(
        encryptionKey,
        nonce,
        dst,
        lowerTransportPDU,
        4
      );

      expect(computed.EncryptionKey).toEqual(expected.EncryptionKey);
      expect(computed.EncDST).toEqual(expected.EncDST);
      expect(computed.EncTransportPDU).toEqual(expected.EncTransportPDU);
      expect(computed.NetMIC).toEqual(expected.NetMIC);
    });

    it("should obfuscate network header correctly", () => {
      const encDst = "64c1";
      const encTransportPdu = "e3fa2f660b0bf379f3";
      const netmic = "16b8531c";
      const ctl = "0";
      const ttl = "07";
      const seq = "6";
      const src = "0008";
      const ivIndex = "00000000";
      const privacyKey = "fc3d6584ce3c2dbae671c44a8e76158a";

      const expected = {
        privacyKey: privacyKey,
        privacyRandom: "64c1e3fa2f660b",
        pecbInput: "00000000000000000064c1e3fa2f660b",
        pecb: "1f8d84ac2ff0",
        ctl_ttl_seq_src: "070000060008",
        obfuscated_ctl_ttl_seq_src: "188d84aa2ff8",
      };

      const computed = crypto.obfuscate(
        encDst,
        encTransportPdu,
        netmic,
        ctl,
        ttl,
        seq,
        src,
        ivIndex,
        privacyKey
      );

      expect(computed.privacyKey).toEqual(expected.privacyKey);
      expect(computed.privacyRandom).toEqual(expected.privacyRandom);
      expect(computed.pecbInput).toEqual(expected.pecbInput);
      expect(computed.pecb).toEqual(expected.pecb);
      expect(computed.ctl_ttl_seq_src).toEqual(expected.ctl_ttl_seq_src);
      expect(computed.obfuscated_ctl_ttl_seq_src).toEqual(expected.obfuscated_ctl_ttl_seq_src);
    });

    it("should compute provisioning salt successfully", () => {
      const confirmationSalt = "5faabe187337c71cc6c973369dcaa79a";
      const randomProvisioner = "8b19ac31d58b124c946209b5db1021b9";
      const randomDevice = "55a2a2bca04cd32ff6f346bd0a0c1a3a";

      const expected = "a21c7d45f201cf9489a2fb57145015b4";
      const computed = crypto.makeProvisioningSalt(
        confirmationSalt,
        randomProvisioner,
        randomDevice
      );
      expect(computed).toEqual(expected);
    });

    it("should compute session key successfully", () => {
      const ecdh = "ab85843a2f6d883f62e5684b38e307335fe6e1945ecd19604105c6f23221eb69";
      const provSalt = "a21c7d45f201cf9489a2fb57145015b4";
      const prsk = "7072736b";

      const expected = "c80253af86b33dfa450bbdb2a191fea3";
      const computed = crypto.makeSessionKey(ecdh, provSalt);
      expect(computed).toEqual(expected);
    });

    it("should compute session nonce correctly", () => {
      const ecdh = "ab85843a2f6d883f62e5684b38e307335fe6e1945ecd19604105c6f23221eb69";
      const provisioningSalt = "a21c7d45f201cf9489a2fb57145015b4";

      const expected = "da7ddbe78b5f62b81d6847487e";
      const computed = crypto.makeSessionNonce(ecdh, provisioningSalt);
      expect(computed).toEqual(expected);
    });

    it("should encrypt provisioning data successfully", () => {
      const sessionKey = "c80253af86b33dfa450bbdb2a191fea3";
      const sessionNonce = "da7ddbe78b5f62b81d6847487e";
      const provisioningData = "efb2255e6422d330088e09bb015ed707056700010203040b0c";

      const expected: EncryptedProvisioningData = {
        encProvisioningData: "d0bd7f4a89a2ff6222af59a90a60ad58acfe3123356f5cec29",
        provisioningDataMIC: "73e0ec50783b10c7",
      };
      const computed = crypto.encryptProvisioningData(sessionKey, sessionNonce, provisioningData);
      expect(computed.encProvisioningData).toEqual(expected.encProvisioningData);
      expect(computed.provisioningDataMIC).toEqual(expected.provisioningDataMIC);
    });
  });

  describe("payload decryption and deobfuscation test", () => {
    it("should deobfuscate network header correctly", () => {
      const obfuscatedData = "188d84aa2ff8";
      const privacyRandom = "64c1e3fa2f660b";
      const ivIndex = "00000000";
      const privacyKey = "fc3d6584ce3c2dbae671c44a8e76158a";

      const expected = {
        privacyKey: privacyKey,
        privacyRandom: privacyRandom,
        pecbInput: "00000000000000000064c1e3fa2f660b",
        pecb: "1f8d84ac2ff0",
        ctl_ttl_seq_src: "070000060008",
      };

      const computed = crypto.deobfuscate(obfuscatedData, privacyRandom, ivIndex, privacyKey);

      expect(computed.privacyKey).toEqual(expected.privacyKey);
      expect(computed.privacyRandom).toEqual(expected.privacyRandom);
      expect(computed.pecbInput).toEqual(expected.pecbInput);
      expect(computed.pecb).toEqual(expected.pecb);
      expect(computed.ctl_ttl_seq_src).toEqual(expected.ctl_ttl_seq_src);
    });
  });
});
