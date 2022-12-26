import crypto, {
  AuthenticatedEncryptedAccessPayload,
  AuthenticatedEncryptedNetworkPayload,
} from "./crypto";
import utils from "../utils/utils";

export type ProxyPDU = string;
export enum MessageType {
  NETWORK_PDU = 0,
  PROXY_CONFIGURATION = 2,
}
const finalizeProxyPDU = (finalizedNetworkPDU: string, messageType: MessageType): ProxyPDU => {
  // No segmentation
  const sar = 0;
  const sm = (sar << 6) | messageType;

  let proxyPDU = "" + utils.intToHex(sm);

  return proxyPDU + finalizedNetworkPDU;
};

export interface FinalizeNetworkPDUInput {
  ivi: number;
  nid: string;
  obfuscated_ctl_ttl_seq_src: string;
  encDst: string;
  encTransportPdu: string;
  netmic: string;
}
const finalizeNetworkPDU = ({
  ivi,
  nid,
  obfuscated_ctl_ttl_seq_src,
  encDst,
  encTransportPdu,
  netmic,
}: FinalizeNetworkPDUInput) => {
  const iviInt = parseInt(ivi.toString(), 16);
  const nidInt = parseInt(nid, 16);
  const npdu1 = utils.intToHex((iviInt << 7) | nidInt);
  const netpdu = npdu1 + obfuscated_ctl_ttl_seq_src + encDst + encTransportPdu + netmic;

  return netpdu;
};

export interface ObfuscateNetworkPDUInput {
  encryptedNetworkPayload: AuthenticatedEncryptedNetworkPayload;
  ctl: string;
  ttl: string;
  seq: number;
  src: string;
  ivIndex: string;
  privacyKey: string;
}
const obfuscateNetworkPDU = ({
  encryptedNetworkPayload,
  ctl,
  ttl,
  seq,
  ivIndex,
  privacyKey,
  src,
}: ObfuscateNetworkPDUInput) => {
  const obfuscated = crypto.obfuscate(
    encryptedNetworkPayload.EncDST,
    encryptedNetworkPayload.EncTransportPDU,
    encryptedNetworkPayload.NetMIC,
    ctl,
    ttl,
    seq,
    src,
    ivIndex,
    privacyKey
  );

  return obfuscated;
};

export interface MakeSecureNetworkLayerParams {
  encryptionKey: string;
  dst: string;
  lowerTransportPDU: string;
  ctl?: string; // not needed for Proxy nonce
  ttl?: string; // not needed for Proxy nonce
  seq: number;
  src: string;
  ivIndex: string;
  nonceType: "proxy" | "network";
}
const makeSecureNetworkLayer = ({
  encryptionKey,
  dst,
  lowerTransportPDU,
  ctl,
  ttl,
  seq,
  src,
  ivIndex,
  nonceType,
}: MakeSecureNetworkLayerParams): AuthenticatedEncryptedNetworkPayload => {
  let nonce = "";
  let netMicSize = 4;
  if (nonceType == "network") {
    nonce = makeNetworkNonce(ctl!, ttl!, seq, src, ivIndex);
  } else {
    nonce = makeProxyNonce(seq, src, ivIndex);
    netMicSize = 8;
  }

  const networkPDU = crypto.authenticateEncryptNetworkPayload(
    encryptionKey,
    nonce,
    dst,
    lowerTransportPDU,
    netMicSize
  );

  return networkPDU;
};

export interface MakeLowerTransportPDUParams {
  AID: string;
  upperTransportPDU: AuthenticatedEncryptedAccessPayload;
}
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
 * @param {MakeLowerTransportPDUParams} LowerTransportPDUInput
 *
 * @returns {string} Lower Transport PDU.
 */
const makeLowerTransportPDU = ({ AID, upperTransportPDU }: MakeLowerTransportPDUParams): string => {
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

export type AccessPayload = string;
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
const makeAccessPayload = (opCode: string, params: string): AccessPayload => {
  let accessPayload = opCode + params;

  return accessPayload as AccessPayload;
};

export interface MakeUpperTransportPDUParams {
  seq: number; // Sequence Number of the Access Message. Refer to Mesh Profile Specification 3.8.3.
  src: string; // Source Address in Hex.
  dst: string; // Destination Address in Hex.
  ivIndex: string; // IV Index in Hex. Refer to Mesh Profile Specification 3.8.4.
  appKey: string; // AppKey.
  accessPayload: string; // Access Payload.
}
/**
 * The upper transport PDU consists of an encrypted version of the access payload and a message
 * authentication code called the TransMIC field.
 *
 * @param {MakeUpperTransportPDUParams} UpperTransportPDUInput
 *
 * @returns {AuthenticatedEncryptedAccessPayload} AuthenticatedEncryptedAccessPayload
 */
const makeUpperTransportPDU = ({
  seq,
  src,
  dst,
  ivIndex,
  appKey,
  accessPayload,
}: MakeUpperTransportPDUParams): AuthenticatedEncryptedAccessPayload => {
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
 * Create the Network nonce.
 *
 * Composition:
 *
 * | Nonce Type | CTL and TTL  | SEQ      | SRC      | Pad      | IV Index |
 * | 1 octet    | 1 octet      | 3 octets | 2 octets | 2 octets | 4 octets |
 *
 * Refer to Mesh Profile Specification 3.8.5.1.
 *
 * @param {string} ctl CTL. Refer to Mesh Profile Specification 3.4.4.3.
 * @param {string} ttl TTL. Refer to Mesh Profile Specification 3.4.4.4.
 * @param {number} seq Sequence Number of the Access Message.
 * @param {string} src Source Address.
 * @param {string} ivIndex IV Index in Hex. Refer to Mesh Profile Specification 3.8.4.
 *
 * @returns {string} Network nonce.
 */
const makeNetworkNonce = (
  ctl: string,
  ttl: string,
  seq: number,
  src: string,
  ivIndex: string
): string => {
  // Network nonce type
  const nonceType = "00";

  const ctlInt = parseInt(ctl, 16);
  const ttlInt = parseInt(ttl, 16);
  const ctlAndTtl = ctlInt | ttlInt;

  const npdu2 = utils.intToHex(ctlAndTtl);
  const paddedSeq = utils.toHex(seq, 3);

  return nonceType + npdu2 + paddedSeq + src + "0000" + ivIndex;
};

/**
 * Create the Proxy nonce.
 *
 * Composition:
 *
 * | Nonce Type | Pad          | SEQ      | SRC      | Pad      | IV Index |
 * | 1 octet    | 1 octet      | 3 octets | 2 octets | 2 octets | 4 octets |
 *
 * Refer to Mesh Profile Specification 3.8.5.4.
 *
 * @param {number} seq Sequence Number of the Access Message.
 * @param {string} src Source Address.
 * @param {string} ivIndex IV Index in Hex. Refer to Mesh Profile Specification 3.8.4.
 *
 * @returns {string} Network nonce.
 */
const makeProxyNonce = (seq: number, src: string, ivIndex: string): string => {
  // Proxy nonce type
  const nonceType = "03";
  const paddedSeq = utils.toHex(seq, 3);

  return nonceType + "00" + paddedSeq + src + "0000" + ivIndex;
};

const pduBuilder = {
  makeAccessPayload,
  finalizeProxyPDU,
  finalizeNetworkPDU,
  obfuscateNetworkPDU,
  makeSecureNetworkLayer,
  makeLowerTransportPDU,
  makeUpperTransportPDU,
  makeApplicationNonce,
  makeNetworkNonce,
};

export default pduBuilder;
