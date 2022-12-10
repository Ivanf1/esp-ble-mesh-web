import { AES_CCM, AES_CMAC, AES_ECB } from "asmcrypto.js";
import { bytes_to_hex, hex_to_bytes } from "asmcrypto.js/dist_es8/other/utils";
import bigInt from "big-integer";
import utils from "./utils";

interface K2Material {
  NID: string;
  encryptionKey: string;
  privacyKey: string;
}

const ZERO = "00000000000000000000000000000000";

const getAesCmac = (hexKey: string, hexMessage: string) => {
  // const key = CryptoJS.enc.Hex.parse(hexKey);
  // const wordArray = CryptoJS.enc.Utf8.parse(utf8Message);
  // console.log(wordArray);
  // console.log(CryptoJS.CMAC(key, wordArray));

  // return CryptoJS.CMAC(key, wordArray);

  // const key = CryptoJS.enc.Hex.parse(hexKey);
  // const message = utils.byteArrayToWordArray(utils.hexToBytes(hexMessage));
  const uint8ArrayKey = new Uint8Array(hex_to_bytes(hexKey));
  const uint8ArrayMessage = new Uint8Array(hex_to_bytes(hexMessage));
  const result = AES_CMAC.bytes(uint8ArrayMessage, uint8ArrayKey);
  return bytes_to_hex(result);
};

const s1 = (M: any) => {
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

const meshAuthEncAccessPayload = (hexAppKey: string, hexNonce: string, hexPayload: string) => {
  const u8Key = utils.hexToU8A(hexAppKey);
  const u8Nonce = utils.hexToU8A(hexNonce);
  const u8Payload = utils.hexToU8A(hexPayload);

  const authEncAccess = AES_CCM.encrypt(u8Payload, u8Key, u8Nonce, new Uint8Array([]), 4);
  const hex = utils.u8AToHexString(authEncAccess);
  const result = {
    EncAccessPayload: hex.substring(0, hex.length - 8),
    TransMIC: hex.substring(hex.length - 8, hex.length),
  };

  return result;
};

const meshAuthEncNetwork = (
  hexEncryptionKey: string,
  hexNonce: string,
  hexDst: string,
  hexTransportPDU: string
) => {
  const arg3 = hexDst + hexTransportPDU;
  const u8_key = utils.hexToU8A(hexEncryptionKey);
  const u8_nonce = utils.hexToU8A(hexNonce);
  const u8_dst_plus_transport_pdu = utils.hexToU8A(arg3);
  const auth_enc_network = AES_CCM.encrypt(
    u8_dst_plus_transport_pdu,
    u8_key,
    u8_nonce,
    new Uint8Array([]),
    4
  );
  const hex = utils.u8AToHexString(auth_enc_network);
  const result = {
    Encryption_Key: hexEncryptionKey,
    EncDST: hex.substring(0, 4),
    EncTransportPDU: hex.substring(4, hex.length - 8),
    NetMIC: hex.substring(hex.length - 8, hex.length),
  };
  return result;
};

const e = (hex_plaintext: string, hex_key: string) => {
  let hex_padding = "";
  let ecb_encrypted = AES_ECB.encrypt(
    hex_to_bytes(hex_plaintext),
    hex_to_bytes(hex_key),
    !hex_to_bytes(hex_padding)
  );
  return bytes_to_hex(ecb_encrypted);
};

const privacyRandom = (enc_dst: string, enc_transport_pdu: string, netmic: string) => {
  const temp = enc_dst + enc_transport_pdu + netmic;
  if (temp.length >= 14) {
    return temp.substring(0, 14);
  } else {
    return "";
  }
};

const obfuscate = function (
  enc_dst: any,
  enc_transport_pdu: any,
  netmic: any,
  ctl: any,
  ttl: any,
  seq: any,
  src: any,
  iv_index: any,
  privacy_key: any
) {
  //1. Create Privacy Random
  const hex_privacy_random = privacyRandom(enc_dst, enc_transport_pdu, netmic);
  var result = {
    privacy_key: "",
    privacy_random: "",
    pecb_input: "",
    pecb: "",
    ctl_ttl_seq_src: "",
    obfuscated_ctl_ttl_seq_src: "",
  };
  result.privacy_key = privacy_key;
  result.privacy_random = hex_privacy_random;
  //2. Calculate PECB
  result.pecb_input = "0000000000" + iv_index + hex_privacy_random;
  const pecb_hex = e(result.pecb_input, privacy_key);
  const pecb = pecb_hex.substring(0, 12);
  result.pecb = pecb;
  const ctl_int = parseInt(ctl, 16);
  const ttl_int = parseInt(ttl, 16);
  const ctl_ttl = ctl_int | ttl_int;
  const ctl_ttl_hex = utils.toHex(ctl_ttl, 1);
  const ctl_ttl_seq_src = ctl_ttl_hex + seq + src;
  result.ctl_ttl_seq_src = ctl_ttl_seq_src;
  // 3. Obfuscate
  const obf = utils.xorU8Array(utils.hexToU8A(ctl_ttl_seq_src), utils.hexToU8A(pecb));
  result.obfuscated_ctl_ttl_seq_src = utils.u8AToHexString(obf);
  return result;
};

const crypto = {
  getAesCmac,
  s1,
  k2,
  k3,
  k4,
  meshAuthEncAccessPayload,
  meshAuthEncNetwork,
  obfuscate,
};

export default crypto;
