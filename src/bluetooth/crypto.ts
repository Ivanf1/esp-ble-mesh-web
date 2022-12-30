import { AES_CCM, AES_CMAC, AES_ECB } from "asmcrypto.js";
import { bytes_to_hex, hex_to_bytes } from "asmcrypto.js/dist_es8/other/utils";
import bigInt from "big-integer";
import utils from "../utils/utils";

interface K2Material {
  NID: string;
  encryptionKey: string;
  privacyKey: string;
}

export interface AuthenticatedEncryptedAccessPayload {
  EncAccessPayload: string;
  TransMIC: string;
}

export interface AuthenticatedEncryptedNetworkPayload {
  EncryptionKey: string;
  EncDST: string;
  EncTransportPDU: string;
  NetMIC: string;
}

const ZERO = "00000000000000000000000000000000";

const getAesCmac = (hexKey: string, hexMessage: string): string => {
  const uint8ArrayKey = new Uint8Array(hex_to_bytes(hexKey));
  const uint8ArrayMessage = new Uint8Array(hex_to_bytes(hexMessage));
  const result = AES_CMAC.bytes(uint8ArrayMessage, uint8ArrayKey);
  return bytes_to_hex(result);
};

const s1 = (M: string) => {
  return getAesCmac(ZERO, M);
};

/*
 * Salts used in k2, k3 and k4 functions.
 *
 * Salt k2 is used in k2 function and derived using s1 with
 * parameter 'smk2' in ASCII.
 * Refer to Mesh Profile Specification 3.8.2.6.
 *
 * Salt k3 is used in k3 function and derived using s1 with
 * parameter 'smk3' in ASCII.
 * Refer to Mesh Profile Specification 3.8.2.7.
 *
 * Salt k4 is used in k4 function and derived using s1 with
 * parameter 'smk4' in ASCII.
 * Refer to Mesh Profile Specification 3.8.2.8.
 */
const salts = {
  k2: s1("736d6b32"), // smk2 in ASCII
  k3: s1("736d6b33"), // smk3 in ASCII
  k4: s1("736d6b34"), // smk4 in ASCII
};

const k1 = (N: string, P: string, salt: string) => {
  // T = AES - CMACsalt(N);
  const T = getAesCmac(salt.toString(), N);

  // k1(N, SALT, P) = AES - CMACt(P);
  const res = getAesCmac(T, P);

  return res;
};

/**
 * The network key material derivation function k2 is used to generate instances
 * of EncryptionKey, PrivacyKey, and NID.
 * Refer to Mesh Profile Specification 3.8.2.6.
 *
 * @param {string} N NetKey.
 * @param {string} P 1 or more octets.
 *
 * @returns {K2Material} k2Material
 */
const k2 = (N: string, P: string): K2Material => {
  // T = AES-CMACsalt (N)
  const T = getAesCmac(salts.k2.toString(), N);
  const T0 = "";

  // M1 = (T0 || P || 0x01)
  const M1 = T0 + P.toString() + "01";
  // T1 = AES-CMACt (T0 || P || 0x01)
  const T1 = getAesCmac(T.toString(), M1);

  // M2 = (T1 || P || 0x02)
  const M2 = T1 + P.toString() + "02";
  // T2 = AES-CMACt (T1 || P || 0x02)
  const T2 = getAesCmac(T.toString(), M2);

  // M3 = (T2 || P || 0x03)
  const M3 = T2 + P.toString() + "03";
  // T3 = AES-CMACt (T2 || P || 0x03)
  const T3 = getAesCmac(T.toString(), M3);

  // T123 = (T1 || T2 || T3)
  const T123 = T1 + T2 + T3;

  // 2^263
  const TOW_POW_263 = bigInt(2).pow(263);

  // Transform T123 to bigInt
  const T123BigInt = bigInt(T123, 16);

  // (T1 || T2 || T3) / 2^263
  const modVal = T123BigInt.divmod(TOW_POW_263);
  // (T1 || T2 || T3) mod 2^263
  const modValBigInt = bigInt(modVal.remainder);

  // k2(N, P) = (T1 || T2 || T3) mod 2^263
  const k2Hex = utils.bigIntegerToHexString(modValBigInt);

  const k2Material: K2Material = {
    NID: k2Hex.substring(0, 2),
    encryptionKey: k2Hex.substring(2, 34),
    privacyKey: k2Hex.substring(34, 66),
  };

  return k2Material;
};

/**
 * Used to generate a public value of 64 bits derived from a private key.
 * Refer to Mesh Profile Specification 3.8.2.7.
 *
 * @param {string} N NetKey.
 *
 * @returns {string} NetworkID.
 */
const k3 = (N: string): string => {
  // T = AES-CMACsalt (N)
  const T = getAesCmac(salts.k3.toString(), N);

  // id64
  const id64Hex = utils.bytesToHex(utils.toAsciiCodes("id64"));
  // AES-CMACt (id64 || 0x01)
  const k3Cmac = getAesCmac(T.toString(), id64Hex + "01");

  // Transform k3Cmac to bigInt
  const k3CmacBigInt = bigInt(k3Cmac.toString(), 16);

  // 2^64
  const TOW_POW_64 = bigInt(2).pow(64);

  // AES-CMACt (id64 || 0x01) / 2^64
  const k3Modval = k3CmacBigInt.divmod(TOW_POW_64);
  // AES-CMACt (id64 || 0x01) mod 2^64
  const k3ModvalBigInt = bigInt(k3Modval.remainder);

  // return the NetworkID
  return utils.bigIntegerToHexString(k3ModvalBigInt);
};

/**
 * Used to calculate the AID field (6 bits).
 *
 * @param {string} N AppKey
 *
 * @returns {string} AID
 */
const k4 = (N: string): string => {
  // T = AES-CMACsalt (N)
  const T = getAesCmac(salts.k4.toString(), N);

  // id6
  const id6Hex = utils.bytesToHex(utils.toAsciiCodes("id6"));

  // AES-CMACt ( id6 || 0x01 )
  const k4Cmac = getAesCmac(T.toString(), id6Hex + "01");

  // Transform k4 to bigInt
  const k4CmacBigInt = bigInt(k4Cmac.toString(), 16);

  // AES-CMACt ( id6 || 0x01 ) / 2^6
  const k4Modval = k4CmacBigInt.divmod(64);
  // K4(N) = AES-CMACt ( id6 || 0x01 ) mod 2^6
  const k4ModvalBigInt = bigInt(k4Modval.remainder);

  return utils.bigIntegerToHexString(k4ModvalBigInt);
};

/**
 * Perform authentication and encryption of the Access Payload.
 *
 * Refer to Mesh Profile Specification 3.8.7.1.
 *
 * @param {string} appKey AppKey.
 * @param {string} applicationNonce Application Nonce.
 * @param {string} applicationPayload Application Payload.
 *
 * @return {AuthenticatedEncryptedAccessPayload} AuthenticatedEncryptedAccessPayload.
 */
const authenticateEncryptAccessPayload = (
  appKey: string,
  applicationNonce: string,
  applicationPayload: string
): AuthenticatedEncryptedAccessPayload => {
  const u8AppKey = utils.hexToU8A(appKey);
  const u8Nonce = utils.hexToU8A(applicationNonce);
  const u8Payload = utils.hexToU8A(applicationPayload);

  const authEncAccess = AES_CCM.encrypt(u8Payload, u8AppKey, u8Nonce, new Uint8Array([]), 4);
  const hex = utils.u8AToHexString(authEncAccess);

  const result: AuthenticatedEncryptedAccessPayload = {
    EncAccessPayload: hex.substring(0, hex.length - 8),
    TransMIC: hex.substring(hex.length - 8, hex.length),
  };

  return result;
};

/**
 * Perform authentication and encryption of the Network Payload.
 *
 * Refer to Mesh Profile Specification 3.8.7.2.
 *
 * @param {string} encryptionKey EncryptionKey.
 * @param {string} nonce Network nonce.
 * @param {string} dst Destination address.
 * @param {string} lowerTransportPDU Lower Transport PDU.
 * @param {number} netMicSize Size in bytes of the NetMIC.
 *
 * @returns {AuthenticatedEncryptedNetworkPayload} AuthenticatedEncryptedNetworkPayload.
 */
const authenticateEncryptNetworkPayload = (
  encryptionKey: string,
  nonce: string,
  dst: string,
  lowerTransportPDU: string,
  netMicSize: number
): AuthenticatedEncryptedNetworkPayload => {
  const arg3 = dst + lowerTransportPDU;

  const u8key = utils.hexToU8A(encryptionKey);
  const u8nonce = utils.hexToU8A(nonce);
  const u8dstAndLowerTransportPDU = utils.hexToU8A(arg3);

  const authenticationEncryptionResult = AES_CCM.encrypt(
    u8dstAndLowerTransportPDU,
    u8key,
    u8nonce,
    new Uint8Array([]),
    netMicSize
  );

  const hexResult = utils.u8AToHexString(authenticationEncryptionResult);

  const result: AuthenticatedEncryptedNetworkPayload = {
    EncryptionKey: encryptionKey,
    EncDST: hexResult.substring(0, 4),
    EncTransportPDU: hexResult.substring(4, hexResult.length - netMicSize * 2),
    NetMIC: hexResult.substring(hexResult.length - netMicSize * 2, hexResult.length),
  };

  return result;
};

/**
 * Refer to Mesh Profile Specification 3.8.2.1.
 *
 * @param {string} plaintext
 * @param {string} privacyKey Privacy Key.
 */
const e = (plaintext: string, privacyKey: string) => {
  const ecbEncrypted = AES_ECB.encrypt(hex_to_bytes(plaintext), hex_to_bytes(privacyKey), false);
  return bytes_to_hex(ecbEncrypted);
};

/**
 * Refer to Mesh Profile Specification 3.8.7.3.
 *
 * @param {string} encDst
 * @param {string} encTransportPdu
 * @param {string} netmic
 */
const privacyRandom = (encDst: string, encTransportPdu: string, netmic: string) => {
  // Privacy Random = (EncDST || EncTransportPDU || NetMIC)[0–6]
  const temp = encDst + encTransportPdu + netmic;
  if (temp.length >= 14) {
    return temp.substring(0, 14);
  } else {
    return "";
  }
};

/**
 * Refer to Mesh Profile Specification 3.8.7.3.
 *
 * Fields named like 'a_b_c' are result of concatenation of fields a, b and c.
 *
 */
const obfuscate = function (
  encDst: any,
  encTransportPdu: any,
  netmic: any,
  ctl: any,
  ttl: any,
  seq: any,
  src: any,
  ivIndex: any,
  privacyKey: any
) {
  // Privacy Random = (EncDST || EncTransportPDU || NetMIC)[0–6]
  const hexPrivacyRandom = privacyRandom(encDst, encTransportPdu, netmic);

  const result = {
    privacyKey: privacyKey,
    privacyRandom: hexPrivacyRandom,
    pecbInput: "",
    pecb: "",
    ctl_ttl_seq_src: "",
    obfuscated_ctl_ttl_seq_src: "",
  };

  // Privacy Plaintext = 0x0000000000 || IV Index || Privacy Random
  result.pecbInput = "0000000000" + ivIndex + hexPrivacyRandom;
  // PECB = e (PrivacyKey, Privacy Plaintext)
  const pecb_hex = e(result.pecbInput, privacyKey);
  result.pecb = pecb_hex.substring(0, 12);

  // CTL is only 1 bit and is positioned as the
  // most significant bit in the | CTL TTL | field.
  let ctlInt = 0;
  if (ctl == "1") {
    // Position CTL as the most significant bit 0b10000000.
    ctlInt = 0x80;
  } else {
    ctlInt = parseInt(ctl, 16);
  }

  const ttlInt = parseInt(ttl, 16);
  // | CTL   | TTL   |
  // | 1 bit | 7 bit |
  // |    1 octet    |
  const ctlTtl = ctlInt | ttlInt;

  const ctlTtlHex = utils.toHex(ctlTtl, 1);
  const paddedSeq = utils.toHex(seq, 3);
  // (CTL || TTL || SEQ || SRC)
  result.ctl_ttl_seq_src = ctlTtlHex + paddedSeq + src;

  // ObfuscatedData = (CTL || TTL || SEQ || SRC) ⊕ PECB[0–5]
  const obf = utils.xorU8Array(utils.hexToU8A(result.ctl_ttl_seq_src), utils.hexToU8A(result.pecb));

  result.obfuscated_ctl_ttl_seq_src = utils.u8AToHexString(obf);

  return result;
};

/**
 * Refer to Mesh Profile Specification 3.8.7.
 */
const deobfuscate = (
  obfuscatedData: string,
  privacyRandom: string,
  ivIndex: string,
  privacyKey: string
) => {
  const result = {
    privacyKey: privacyKey,
    privacyRandom: privacyRandom,
    pecbInput: "",
    pecb: "",
    ctl_ttl_seq_src: "",
  };
  // Privacy Plaintext = 0x0000000000 || IV Index || Privacy Random
  result.pecbInput = "0000000000" + ivIndex + privacyRandom;
  const pecb_hex = e(result.pecbInput, privacyKey);
  result.pecb = pecb_hex.substring(0, 12);

  // DeobfuscatedData = ObfuscatedData ⊕ PECB[0–5]
  const deobf = utils.xorU8Array(utils.hexToU8A(obfuscatedData), utils.hexToU8A(result.pecb));
  result.ctl_ttl_seq_src = utils.u8AToHexString(deobf);

  return result;
};

const decryptAndVerify = (key: string, cipher: string, nonce: string) => {
  try {
    const decrypted = AES_CCM.decrypt(
      utils.hexToU8A(cipher),
      utils.hexToU8A(key),
      utils.hexToU8A(nonce),
      new Uint8Array([]),
      4
    );
    return utils.u8AToHexString(decrypted);
  } catch (error) {
    console.log(`Error while decrypting payload: ${error}`);
    return null;
  }
};

/**
 * Refer to Mesh Profile Specification 5.4.2.5.
 */
const makeProvisioningSalt = (
  confirmationSalt: string,
  randomProvisioner: string,
  randomDevice: string
) => {
  // ProvisioningSalt = s1(ConfirmationSalt || RandomProvisioner || RandomDevice).
  return s1(confirmationSalt + randomProvisioner + randomDevice);
};

/**
 * Refer to Mesh Profile Specification 5.4.2.5.
 */
const makeSessionKey = (ecdhSecret: string, provisioningSalt: string) => {
  // SessionKey = k1(ECDHSecret, ProvisioningSalt, “prsk”).
  return crypto.k1(ecdhSecret, "7072736b", provisioningSalt);
};

/**
 * Refer to Mesh Profile Specification 5.4.2.5.
 */
const makeSessionNonce = (ecdhSecret: string, provisioningSalt: string) => {
  // SessionNonce = k1(ECDHSecret, ProvisioningSalt, “prsn”).
  const nonce = crypto.k1(ecdhSecret, "7072736e", provisioningSalt);

  return nonce.substring(6);
};

export interface EncryptedProvisioningData {
  encProvisioningData: string;
  provisioningDataMIC: string;
}
/**
 * Refer to Mesh Profile Specification 5.4.2.5.
 */
const encryptProvisioningData = (
  sessionKey: string,
  sessionNonce: string,
  provisioningData: string
) => {
  const u8SessionKey = utils.hexToU8A(sessionKey);
  const u8SessionNonce = utils.hexToU8A(sessionNonce);
  const u8ProvisioningData = utils.hexToU8A(provisioningData);

  // Encrypted Provisioning Data, Provisioning Data MIC =
  //                              AES-CCM (SessionKey, SessionNonce, Provisioning Data)
  const enc = AES_CCM.encrypt(
    u8ProvisioningData,
    u8SessionKey,
    u8SessionNonce,
    new Uint8Array([]),
    8 // The size of the Provisioning Data MIC is 8 octets
  );

  const encHex = utils.u8AToHexString(enc);

  const result: EncryptedProvisioningData = {
    encProvisioningData: encHex.substring(0, encHex.length - 16),
    provisioningDataMIC: encHex.substring(encHex.length - 16),
  };

  return result;
};

const crypto = {
  getAesCmac,
  s1,
  k1,
  k2,
  k3,
  k4,
  authenticateEncryptAccessPayload,
  authenticateEncryptNetworkPayload,
  obfuscate,
  deobfuscate,
  e,
  privacyRandom,
  decryptAndVerify,
  makeProvisioningSalt,
  makeSessionKey,
  makeSessionNonce,
  encryptProvisioningData,
};

export default crypto;
