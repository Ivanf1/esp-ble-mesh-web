import crypto, {
  AuthenticatedEncryptedAccessPayload,
  AuthenticatedEncryptedNetworkPayload,
} from "./crypto";
import utils from "./utils";

enum NonceType {
  "application",
  "network",
  "device",
  "proxy",
}

const NonceByType = new Map<NonceType, string>([
  [NonceType.network, "00"],
  [NonceType.application, "01"],
  [NonceType.device, "02"],
  [NonceType.proxy, "03"],
]);

export interface AccessPayloadInfo {
  opCode: string;
  params: string;
}

export interface UpperTransportPDUInfo {
  seq: number;
  src: string;
  dst: string;
  ivIndex: string;
  appKey: string;
}

export interface NetworkLayerInfo {
  encryptionKey: string;
  dst: string;
  ttl: string;
  seq: number;
  src: string;
  ivIndex: string;
}

const makeProxyPDU = (
  accessPayloadInfo: AccessPayloadInfo,
  upperTransportPDUInfo: UpperTransportPDUInfo,
  networkLayerInfo: NetworkLayerInfo,
  AID: string,
  privacyKey: string,
  ivi: number,
  NID: string
) => {
  const accessPayload = makeAccessPayload(accessPayloadInfo.opCode, accessPayloadInfo.params);

  const upperTransportPDU = makeUpperTransportPDU(
    upperTransportPDUInfo.seq,
    upperTransportPDUInfo.src,
    upperTransportPDUInfo.dst,
    upperTransportPDUInfo.ivIndex,
    upperTransportPDUInfo.appKey,
    accessPayload
  );

  const lowerTransportPDU = makeLowerTransportPDU(AID, upperTransportPDU);

  const securedNetworkPDU = makeSecureNetworkLayer(
    networkLayerInfo.encryptionKey,
    networkLayerInfo.dst,
    lowerTransportPDU,
    networkLayerInfo.ttl,
    networkLayerInfo.seq,
    networkLayerInfo.src,
    networkLayerInfo.ivIndex
  );

  const ctl = "0";
  const obfuscated = obfuscateNetworkPDU(
    securedNetworkPDU,
    ctl,
    networkLayerInfo.ttl,
    networkLayerInfo.seq,
    networkLayerInfo.src,
    networkLayerInfo.ivIndex,
    privacyKey
  );

  const finalizedNetworkPDU = finalizeNetworkPDU(
    ivi,
    NID,
    obfuscated.obfuscated_ctl_ttl_seq_src,
    securedNetworkPDU.EncDST,
    securedNetworkPDU.EncTransportPDU,
    securedNetworkPDU.NetMIC
  );

  const proxyPDU = finalizeProxyPDU(finalizedNetworkPDU);

  return proxyPDU;
};

const finalizeProxyPDU = (finalizedNetworkPDU: string) => {
  const sar = 0;
  const msg_type = 0;
  const sm = (sar << 6) | msg_type;

  let proxy_pdu = "" + utils.intToHex(sm);
  proxy_pdu = proxy_pdu + finalizedNetworkPDU;

  return proxy_pdu;
};

const finalizeNetworkPDU = (
  ivi: number,
  nid: string,
  obfuscated_ctl_ttl_seq_src: string,
  encDst: string,
  encTransportPdu: string,
  netmic: string
) => {
  const iviInt = parseInt(ivi.toString(), 16);
  const nidInt = parseInt(nid, 16);
  const npdu1 = utils.intToHex((iviInt << 7) | nidInt);
  const netpdu = npdu1 + obfuscated_ctl_ttl_seq_src + encDst + encTransportPdu + netmic;

  return netpdu;
};

const obfuscateNetworkPDU = (
  encryptedNetwordPayload: AuthenticatedEncryptedNetworkPayload,
  ctl: string,
  ttl: string,
  seq: number,
  src: string,
  ivIndex: string,
  privacyKey: string
) => {
  const obfuscated = crypto.obfuscate(
    encryptedNetwordPayload.EncDST,
    encryptedNetwordPayload.EncTransportPDU,
    encryptedNetwordPayload.NetMIC,
    ctl,
    ttl,
    seq,
    src,
    ivIndex,
    privacyKey
  );

  return obfuscated;
};

const makeSecureNetworkLayer = (
  encryptionKey: string,
  dst: string,
  lowerTransportPDU: string,
  ttl: string,
  seq: number,
  src: string,
  ivIndex: string
): AuthenticatedEncryptedNetworkPayload => {
  const networkNonce = makeNetworkNonce(ttl, seq, src, ivIndex);

  const networkPDU = crypto.authenticateEncryptNetworkPayload(
    encryptionKey,
    networkNonce,
    dst,
    lowerTransportPDU
  );

  return networkPDU;
};

/**
 * Compose the Lower Transport PDU. At the moment only Unsegmented
 * Access Messages are supported.
 *
 * Refer to Mesh Profile Specification 3.5.2.
 *
 * Composition:
 *
 * | SEG | AKF | AID | Upper Transport Access PDU |
 * | 1 octet         |                            |
 *
 * @param {string} AID AppKey identifier.
 * @param {Object} upperTransportPDU Upper Transport PDU.
 *
 * @returns {string} Lower Transport PDU.
 */
const makeLowerTransportPDU = (
  AID: string,
  upperTransportPDU: AuthenticatedEncryptedAccessPayload
): string => {
  // SEG is always 0 for Unsegmented Access Messages
  const seg = "0";

  // Application Key Flag. Indicates whether or not the Upper Transport PDU
  // is encrypted whit and AppKey.
  // 1 if it is, 0 if it is not.
  // In our case it is.
  const akf = "1";

  const segInt = parseInt(seg, 16);
  const akfInt = parseInt(akf, 16);
  const aidInt = parseInt(AID, 16);

  const leftLowerTransportPDU = (segInt << 7) | (akfInt << 6) | aidInt;

  const lowerTransportPDU =
    utils.intToHex(leftLowerTransportPDU) +
    upperTransportPDU.EncAccessPayload +
    upperTransportPDU.TransMIC;

  return lowerTransportPDU;
};

/**
 * Compose the Access Payload for the Access Layer.
 *
 * Payload Composition:
 *
 * | OpCode | Parameters |
 *
 * Endianness: Little Endian.
 *
 * Refer to Mesh Profile Specification 3.7.3.
 *
 * @param {string} opCode OpCode
 * @param {string} params Parameters
 *
 * @returns {string} AccessPayload
 */
const makeAccessPayload = (opCode: string, params: string): string => {
  let accessPayload = opCode + params;

  return accessPayload;
};

/**
 * The upper transport PDU consists of an encrypted version of the access payload and a message
 * authentication code called the TransMIC field.
 *
 * @param {string} seq Sequence Number of the Access Message. Refer to Mesh Profile Specification 3.8.3.
 * @param {string} src Source Address in Hex.
 * @param {string} dst Destination Address in Hex.
 * @param {string} ivIndex IV Index in Hex. Refer to Mesh Profile Specification 3.8.4.
 * @param {string} appKey AppKey.
 * @param {string} accessPayload Access Payload.
 *
 * @returns {Object} AuthenticatedEncryptedAccessPayload
 */
const makeUpperTransportPDU = (
  seq: number,
  src: string,
  dst: string,
  ivIndex: string,
  appKey: string,
  accessPayload: string
): AuthenticatedEncryptedAccessPayload => {
  const applicationNonce = makeApplicationNonce(seq, src, dst, ivIndex);

  const upperTransportPDU = crypto.authenticateEncryptAccessPayload(
    appKey,
    applicationNonce,
    accessPayload
  );

  return upperTransportPDU;
};

/**
 * Create the Application nonce.
 *
 * Composition:
 *
 * | Nonce type | ASZMIC and Pad | SEQ      |  SRC     | DST      | IV Index |
 * | 1 octet    | 1 octet        | 3 octets | 2 octets | 2 octets | 4 octets |
 *
 * Refer to Mesh Profile Specification 3.8.5.2.
 *
 * @param {string} seq Sequence Number of the Access Message. Refer to Mesh Profile Specification 3.8.3.
 * @param {string} src Source Address in Hex.
 * @param {string} dst Destination Address in Hex.
 * @param {string} ivIndex IV Index in Hex. Refer to Mesh Profile Specification 3.8.4.
 *
 * @returns {string} Application nonce.
 */
const makeApplicationNonce = (seq: number, src: string, dst: string, ivIndex: string): string => {
  // Application nonce type
  const nonceType = "01";
  // No segmentation
  const aszmic = "00";
  const paddedSeq = utils.toHex(seq, 3);

  return nonceType + aszmic + paddedSeq + src + dst + ivIndex;
};

/**
 * Create the Network nonce. Only Access Messages are supported.
 *
 * Composition:
 *
 * | Nonce Type | CTL and TTL  | SEQ      | SRC      | Pad      | IV Index |
 * | 1 octet    | 1 octet      | 3 octets | 2 octets | 2 octets | 4 octets |
 *
 * Refer to Mesh Profile Specification 3.8.5.1.
 *
 * @param {string} ttl TTL. Refer to Mesh Profile Specification 3.4.4.4.
 * @param {number} seq Sequence Number of the Access Message.
 * @param {string} src Source Address.
 * @param {string} ivIndex IV Index in Hex. Refer to Mesh Profile Specification 3.8.4.
 *
 * @returns {string} Network nonce.
 */
const makeNetworkNonce = (ttl: string, seq: number, src: string, ivIndex: string): string => {
  // Network nonce type
  const nonceType = "00";
  // CTL for Access Message. Refer to Mesh Profile Specification 3.4.4.3.
  const ctl = "0";

  const ctlInt = parseInt(ctl, 16);
  const ttlInt = parseInt(ttl, 16);
  const ctlAndTtl = ctlInt | ttlInt;

  const npdu2 = utils.intToHex(ctlAndTtl);
  const paddedSeq = utils.toHex(seq, 3);

  // N = utils.normaliseHex(hex_encryption_key); ????????

  return nonceType + npdu2 + paddedSeq + src + "0000" + ivIndex;
};

const pduBuilder = {
  makeProxyPDU,
  makeAccessPayload,
  makeApplicationNonce,
};

export default pduBuilder;
