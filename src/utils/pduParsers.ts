import crypto from "./crypto";
import utils from "./utils";

const validatePDU = (
  pdu: Uint8Array,
  privacyKey: string,
  NID: string,
  encryptionKey: string,
  appKey: string
) => {
  /**
   * Naming convention.
   * Variable names are always in camel case except for this cases:
   * 1) foo_bar -> a name like this signifies the concatenation of the fields
   *    foo and bar.
   * 2) foo_bar_hex -> a name like this signifies the concatenation of the
   *    fields foo and bar and the result is an hex string.
   */

  /**
   * ------------------------------------------------------------------------------------
   * Proxy PDU.
   * Refer to Mesh Profile Specification 6.3.
   * ------------------------------------------------------------------------------------
   */

  // Length validation
  if (pdu.length < 1) {
    console.log("Error: No data received");
    return;
  }

  // Extract SAR, MessageType (first octet).
  // Refer to Mesh Profile Specification 6.3.1.
  const sar_messageType = pdu.subarray(0, 1);
  const sar_messageTypeInt = utils.U8ArrayToInt(sar_messageType);

  // SAR is contained within the first two bits.
  const sar = (sar_messageTypeInt & 0xc0) >> 6;
  if (sar != 0) {
    console.log(
      `Invalid value for SAR. Value is ${sar} but only 0x00 (Complete Message) is currently supported`
    );
  }

  // MessageType is contained within the last 6 bits.
  const messageType = sar_messageTypeInt & 0x3f;
  if (messageType != 0) {
    // Refer to Mesh Profile Specification 6.3.1 Table 6.3.
    console.log(
      `Invalid value for Message Type. Value is ${messageType} but only 0x00 (Network PDU) is currently supported`
    );
  }

  /**
   * ------------------------------------------------------------------------------------
   * Network Layer.
   * Refer to Mesh Profile Specification 3.4.
   * ------------------------------------------------------------------------------------
   */

  const networkPdu = pdu.subarray(1, pdu.length);

  // IV Index and NID are contained within the first octet of the Network PDU.
  // Refer to Mesh Profile Specification 3.4.4.
  const ivIndex_nid_hex = utils.u8AToHexString(networkPdu).substring(0, 2);
  const ivIndex_nid = parseInt(ivIndex_nid_hex);

  // IV Index and NID are not obfuscated, we can extract them directly.
  // IV Index is contained within the first bit.
  const ivIndexPduInt = ivIndex_nid & 0x80;
  const ivIndexPdu = utils.toHex(ivIndexPduInt, 4);
  // NID is contained within the last 7 bits.
  const nidPdu = ivIndex_nid & 0x7f;

  // CTL, TTL, SEQ, SRC are contained within octets from 1 to 6 of the Network PDU.
  // This sequence of fields is obfuscated.
  // Refer to Mesh Profile Specification 3.4.4.
  const ctl_ttl_seq_src = networkPdu.subarray(1, 7);

  // DST is contained within octets from 7 to 8 of the Network PDU.
  // Refer to Mesh Profile Specification 3.4.4.
  const encDst = networkPdu.subarray(7, 9);

  // TransportPDU has a variable length, but we know it starts after
  // DST which ends at octet 8, and ends right before the NetMIC which,
  // for our application, is always 4 octets long.
  // Refer to Mesh Profile Specification 3.4.4.
  const encTransportPdu = networkPdu.subarray(9, networkPdu.length - 4);

  // NetMIC, for our application, is always 4 octets long and is
  // contained within the last 4 octets of the Network PDU.
  // Refer to Mesh Profile Specification 3.4.4.
  const netMic = networkPdu.subarray(networkPdu.length - 4, networkPdu.length);

  const privacyRandom = crypto.privacyRandom(
    utils.u8AToHexString(encDst),
    utils.u8AToHexString(encTransportPdu),
    utils.u8AToHexString(netMic)
  );
  // Deobfuscate the Network PDU.
  // Refer to Mesh Profile Specification 3.8.7.3.
  const deobfuscatedNetworkPdu = crypto.deobfuscate(
    utils.u8AToHexString(ctl_ttl_seq_src),
    privacyRandom,
    ivIndexPdu,
    privacyKey
  );

  // Upon receiving a message, the node shall check if the value of the NID field value matches
  // one or more known NIDs. If the NID field value does not match a known NID, then the
  // message shall be ignored.
  // Refer to Mesh Profile Specification 3.4.6.3.
  if (nidPdu.toString() != NID) {
    console.log(`Unknown NID ${nidPdu}, application's NID: ${NID} - discarding message`);
    return;
  }

  // Derive Network nonce.
  // Refer to Mesh Profile Specification 3.8.5.1 Table 3.45.
  const networkNonce = "00" + deobfuscatedNetworkPdu.ctl_ttl_seq_src + "0000" + ivIndexPdu;

  // CTL and TTL are in a single octet.
  // Refer to Mesh Profile Specification 3.8.5.1 Table 3.46.
  const ctl_ttl_pdu = deobfuscatedNetworkPdu.ctl_ttl_seq_src.substring(0, 2);
  // CTL is contained within the first bit.
  const ctlInt = (parseInt(ctl_ttl_pdu, 16) & 0x80) >> 7;
  // TTL is contained within the last 7 bits.
  const ttlInt = parseInt(ctl_ttl_pdu, 16) & 0x7f;

  // Refer to Mesh Profile Specification 3.5.2 Table 3.9.
  if (ctlInt != 0) {
    console.log(
      `Invalid value for CTL. Value is ${ctlInt} but only 0 (Unsegmented/Segmented Access Message) is currently supported`
    );
    return;
  }

  // SEQ is contained within 3 octets.
  // Refer to Mesh Profile Specification 3.8.5.1 Table 3.46.
  const seqPdu = deobfuscatedNetworkPdu.ctl_ttl_seq_src.substring(2, 8);

  // SRC is contained within 2 octets.
  // Refer to Mesh Profile Specification 3.8.5.1 Table 3.46.
  const srcPdu = deobfuscatedNetworkPdu.ctl_ttl_seq_src.substring(8, 12);

  // The encrypted part of the Network PDU contains DST (Destination Address)
  // and TransportPDU. NetMIC is authenticates that the DST and
  // TransportPDU have not been changed.
  // Refer to Mesh Profile Specification 3.4.4 Figure 3.7.
  const encryptedNetworkData =
    utils.u8AToHexString(encDst) +
    utils.u8AToHexString(encTransportPdu) +
    utils.u8AToHexString(netMic);
  // Decrypt the Network PDU.
  // Refer to Mesh Profile Specification 3.8.7.2.
  const decryptedNetworkData = crypto.decryptAndVerify(
    encryptionKey,
    encryptedNetworkData,
    networkNonce
  );
  if (!decryptedNetworkData) {
    console.log("network data decryption failed.");
    return;
  }

  // Once the encrypted Network PDU has been decrypted we can
  // extract DST and TransportPDU.
  // DST is contained within the first two octets.
  // Refer to Mesh Profile Specification 3.4.4 Figure 3.7.
  const dstPdu = decryptedNetworkData.substring(0, 4);
  // TransportPDU is contained within the remaining octets.
  // Refer to Mesh Profile Specification 3.4.4 Figure 3.7.
  const lowerTransportPdu = decryptedNetworkData.substring(4, decryptedNetworkData.length);

  /**
   * ------------------------------------------------------------------------------------
   * Lower Transport Layer.
   * Refer to Mesh Profile Specification 3.5.
   * ------------------------------------------------------------------------------------
   */

  // Currently, only Unsegmented Access Messages are supported.
  // Refer to Mesh Profile Specification 3.5.2.1.
  // SEG, AKF and AID are contained within the first octet.
  const seg_akf_aid = lowerTransportPdu.substring(0, 2);
  // SEG is contained within the first bit of the first octet.
  const segInt = (parseInt(seg_akf_aid, 16) & 0x80) >> 7;
  // AKF is contained within the second bit of the first octet.
  const akfInt = (parseInt(seg_akf_aid, 16) & 0x40) >> 6;
  // AID is contained within the remaining 6 bits of the first octet.
  const aidInt = parseInt(seg_akf_aid, 16) & 0x3f;

  // Refer to Mesh Profile Specification 3.5.2 Table 3.9.
  if (segInt != 0) {
    console.log(
      `Invalid value for SEG. Value is ${segInt} but only 0 (no segmentation) is currently supported`
    );
    return;
  }

  /**
   * ------------------------------------------------------------------------------------
   * Upper Transport Layer.
   * Refer to Mesh Profile Specification 3.6.
   * ------------------------------------------------------------------------------------
   */

  // The Upper Transport Access PDU starts at octet 1 and spans all the packet.
  // Refer to Mesh Profile Specification 3.5.2.1 Figure 3.9.
  const upperTransportAccessPdu = lowerTransportPdu.substring(2, lowerTransportPdu.length);
  // The Encrypted Access Payload has a variable length, but we know that for
  // unsegmented messages, the size of the TransMIC is 32 bits (4 octets) for data messages.
  // Refer to Mesh Profile Specification 3.6.2.2
  const accessPayload = upperTransportAccessPdu.substring(0, upperTransportAccessPdu.length - 8);
  // The Message Integrity Check for Transport (TransMIC) is a 32-bit or 64-bit field that
  // authenticates that the access payload has not been changed. For unsegmented messages,
  // the size of the TransMIC is 32 bits for data messages.
  // Refer to Mesh Profile Specification 3.6.2.2
  const transMic = upperTransportAccessPdu.substring(
    upperTransportAccessPdu.length - 8,
    upperTransportAccessPdu.length
  );

  /**
   * ------------------------------------------------------------------------------------
   * Access Layer.
   * Refer to Mesh Profile Specification 3.7.
   * ------------------------------------------------------------------------------------
   */

  // Refer to Mesh Profile Specification 3.8.5.2.
  const appNonce = "0100" + seqPdu + srcPdu + dstPdu + ivIndexPdu;

  const decryptedAccessPayload = crypto.decryptAndVerify(
    appKey,
    accessPayload + transMic,
    appNonce
  );
  if (!decryptedAccessPayload) {
    console.log("access payload decryption failed.");
    return;
  }

  const accessPayloadData = getOpcodeAndParams(decryptedAccessPayload);
  if (!accessPayloadData) {
    console.log("Error while extracting Access Payload Data.");
    return;
  }

  const opcode = accessPayloadData.opcode;
  const params = accessPayloadData.params;

  console.log(" ");
  console.log("----------");
  console.log("Proxy PDU");
  console.log("  SAR=" + utils.intToHex(sar));
  console.log("  MESSAGE TYPE=" + utils.intToHex(messageType));
  console.log("  NETWORK PDU");
  console.log("    IVI=" + ivIndexPdu);
  console.log("    NID=" + nidPdu);
  console.log("    CTL=" + utils.intToHex(ctlInt));
  console.log("    TTL=" + utils.intToHex(ttlInt));
  console.log("    SEQ=" + seqPdu);
  console.log("    SRC=" + srcPdu);
  console.log("    DST=" + dstPdu);
  console.log("    Lower Transport PDU");
  console.log("      SEG=" + utils.intToHex(segInt));
  console.log("      AKF=" + utils.intToHex(akfInt));
  console.log("      AID=" + utils.intToHex(aidInt));
  console.log("      Upper Transport PDU");
  console.log("        Access Payload");
  console.log("          opcode=" + opcode);
  if (accessPayloadData.companyCode) {
    console.log("          company_code=" + accessPayloadData.companyCode);
  }
  console.log("          params=" + params);
  console.log("        TransMIC=" + transMic);
  console.log("    NetMIC=" + netMic);
};

interface AccessPayloadData {
  opcode: string;
  companyCode?: string;
  params: string;
}
/**
 * Extract Opcode, CompanyCode (if defined) and Parameters from an Access Payload.
 * Refer to Mesh Profile Specification 3.7.3.
 *
 * @param {string} accessPayload Access Payload.
 * @returns {AccessPayloadData} AccessPayloadData.
 */
const getOpcodeAndParams = (accessPayload: string): AccessPayloadData | null => {
  const result: AccessPayloadData = {
    opcode: "",
    params: "",
  };

  // Minimum valid size for an Access Payload is 1 octet.
  // Refer to Mesh Profile Specification 3.7.3.
  if (accessPayload.length < 2) {
    console.log(
      `Invalid length for Access Payload. Length is ${accessPayload.length} but min length is 2 (1 octet).`
    );
    return null;
  }
  // Maximum valid size for an Access Payload is 380 octets.
  // Refer to Mesh Profile Specification 3.7.3.
  if (accessPayload.length > 190) {
    console.log(
      `Invalid length for Access Payload. Length is ${accessPayload.length} but max length is 190 (380 octets).`
    );
    return null;
  }

  // The Access Payload is comprised of two parts:
  // 1) Opcode - 1, 2, or 3 octets
  // 2) Parameters - 0 to 379 octets

  // The first octet of the opcode determines the number of octets that are part of the opcode.
  const firstOctetOfOpcode = parseInt(accessPayload.substring(0, 2), 16);

  // An opcode equal to 0b01111111 (0x7f) is reserved for future use and
  // is not currently supported.
  // Refer to Mesh Profile Specification 3.7.3.1 Table 3.43.
  if ((firstOctetOfOpcode & 0x7f) == 0x7f) {
    console.log("Opcode value is reserved for future use.");
    return null;
  }

  // We need to determine the number of octets of the opcode.
  // Refer to Mesh Profile Specification 3.7.3.1.
  let opcodeLen = 0;
  // If the most significant bit of the first octet of the opcode is 0, then the opcode
  // contains a single octet.
  if ((firstOctetOfOpcode & 0x80) != 0x80) {
    opcodeLen = 1;
  } else {
    // If the most significant bit is 1, then we need to check the second most
    // significant bit.
    // If the second most significant bit is 0, then the opcode contains two octets.
    if ((firstOctetOfOpcode & 0x40) != 0x40) {
      opcodeLen = 2;
    } else {
      // If the second most significant bit is 1, then the opcode contains three octets.
      opcodeLen = 3;
    }
  }

  // Knowing the length of the opcode we can extract it.
  let fullOpcode = accessPayload.substring(0, 2 * opcodeLen);

  let companyCode = "";
  let opcode = 0;

  if (opcodeLen == 3) {
    // The 3-octet opcodes are used for manufacturer-specific opcodes.
    // The company identifiers are 16-bit values defined by the Bluetooth SIG and are
    // coded into the second and third octets of the 3-octet opcodes.
    // Refer to Mesh Profile Specification 3.7.3.1.
    companyCode = fullOpcode.substring(2, 6);
    opcode = parseInt(fullOpcode.substring(0, 2), 16);

    result.companyCode = companyCode;
    result.opcode = utils.toHex(opcode, 1);
  } else if (opcodeLen == 2) {
    opcode = parseInt(fullOpcode, 16);
    result.opcode = utils.toHex(opcode, 2);
  } else {
    opcode = parseInt(fullOpcode, 16);
    result.opcode = utils.toHex(opcode, 1);
  }

  // Parameters start right after opcode and span the whole packet.
  // Refer to Mesh Profile Specification 3.7.3 Table 3.41.
  result.params = accessPayload.substring(2 * opcodeLen, accessPayload.length);

  return result;
};

const pduParser = {
  validatePDU,
};

export default pduParser;
