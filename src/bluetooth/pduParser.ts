import crypto from "./crypto";
import utils from "../utils/utils";
import { MessageType } from "./PduBuilder";
import SegmentsMap from "./SegmentsMap";
import MeshConfigurationManager from "./MeshConfigurationManager";
import PDUBuilder from "./PduBuilder";

/**
 * Naming convention.
 * Variable names are always in camel case except for this cases:
 * 1) foo_bar -> a name like this indicates the concatenation of the fields
 *    foo and bar.
 * 2) foo_bar_hex -> a name like this indicates the concatenation of the
 *    fields foo and bar and the result is an hex string.
 */

const TAG = "PDU PARSER";

export interface ProxyPDU {
  messageType: MessageType;
  data: AccessPayloadData;
  src?: string;
  dst?: string;
}
export interface AccessPayloadData {
  opcode: string;
  companyCode?: string;
  params: string;
}
interface ParsedNetworkPDU {
  seq: string;
  src: string;
  dst: string;
  ivIndex: string;
  ctl: number;
  lowerTransportPDU: string;
}
export interface ParsedLowerTransportPDU {
  upperTransportAccessPDU: string;
  akf: number;
  isSegmented: boolean;
  seq: string;
  sego?: number; // only set if [isSegmented] is true
  segn?: number; // only set if [isSegmented] is true
  szmic?: number; // only set if [isSegmented] is true
}

class PDUParser {
  private static _instance: PDUParser;

  private segmentsMap: SegmentsMap;
  private meshManager: MeshConfigurationManager;
  private PDUBuilder: PDUBuilder;

  private constructor(meshManager: MeshConfigurationManager) {
    this.segmentsMap = SegmentsMap.getInstance();
    this.meshManager = meshManager;
    this.PDUBuilder = PDUBuilder.getInstance();
  }

  public static getInstance(meshManager: MeshConfigurationManager) {
    if (!this._instance) {
      this._instance = new PDUParser(meshManager);
    }
    return this._instance;
  }

  /**
   * Proxy PDU.
   * Refer to Mesh Profile Specification 6.3.
   */
  public parsePDU(pdu: Uint8Array) {
    console.log(`${TAG}: received pdu: ${utils.u8AToHexString(pdu)}`);

    // Length validation
    if (pdu.length < 1) {
      console.error("Error: No data received.");
      return;
    }

    // Extract SAR, MessageType (first octet).
    // Refer to Mesh Profile Specification 6.3.1.
    const sar_messageType = pdu.subarray(0, 1);
    const sar_messageTypeInt = utils.U8ArrayToInt(sar_messageType);

    // SAR is contained within the first two bits.
    const sar = (sar_messageTypeInt & 0xc0) >> 6;
    if (sar != 0) {
      console.error(
        `Invalid value for SAR. Value is ${sar} but only 0x00 (Complete Message) is currently \
      supported.`
      );
      return;
    }

    // MessageType is contained within the last 6 bits.
    const messageType = sar_messageTypeInt & 0x3f;

    const dataRaw = pdu.subarray(1, pdu.length);
    const dataHex = utils.u8AToHexString(dataRaw);
    switch (messageType as MessageType) {
      case MessageType.NETWORK_PDU:
        const parsedNetworkPDU = this.parseNetworkPDU(pdu);
        if (!parsedNetworkPDU) return;

        /**
         * If the received message is a Control Message, it can either be a normal Control Message
         * or a Segmented Acknowledgment Message. If it is the latter, we do not need to proceed
         * further in the decryption.
         */
        if (parsedNetworkPDU.ctl) {
          const res = this.parseControlMessage(parsedNetworkPDU.lowerTransportPDU);
          if (!res) return;

          parsedNetworkPDU.lowerTransportPDU = res;
        }

        const lowerTransportPDU = this.parseLowerTransportPDU(parsedNetworkPDU);
        if (!lowerTransportPDU) return;

        let accessPayload = "";

        if (lowerTransportPDU.isSegmented) {
          let key = parsedNetworkPDU.src + parsedNetworkPDU.dst;
          this.segmentsMap.putSegment(key, lowerTransportPDU);

          // Need to wait for remaining segments.
          if (!this.segmentsMap.areAllSegmentsForKeyPresent(key)) return;

          console.log(`Received all segments.`);

          const segments = this.segmentsMap.getSegments(key);
          const segmentsPayload = segments?.map((s) => s.upperTransportAccessPDU);

          const ap = this.reassembleSegmentedAccessPayload(
            segmentsPayload!,
            lowerTransportPDU.akf
              ? this.meshManager.getAppKey()
              : this.meshManager.getNodeDevKey(parsedNetworkPDU.src)!,
            segments![0].seq,
            parsedNetworkPDU.src,
            parsedNetworkPDU.dst,
            lowerTransportPDU.akf
          );

          this.segmentsMap.deleteSegments(key);

          if (!ap) return;
          accessPayload = ap;
        } else {
          const upperTransportAccessPDU = this.parseUpperTransportAccessPDU(
            lowerTransportPDU,
            parsedNetworkPDU.dst,
            parsedNetworkPDU.src,
            parsedNetworkPDU.seq,
            lowerTransportPDU.akf
          );
          if (!upperTransportAccessPDU) return;

          accessPayload = upperTransportAccessPDU;
        }

        const result = this.parseAccessPayload(accessPayload);
        if (!result) return;

        return {
          messageType: MessageType.NETWORK_PDU,
          data: result,
          src: parsedNetworkPDU.src,
          dst: parsedNetworkPDU.dst,
        } as ProxyPDU;

      case MessageType.PROVISIONING:
        return {
          messageType: MessageType.PROVISIONING,
          data: {
            opcode: dataHex.substring(0, 2),
            params: dataHex.substring(2),
          },
        } as ProxyPDU;

      default:
        console.error(
          `Invalid value for Message Type. Value is ${messageType} but only 0x00 (Network PDU), \
        0x03 (Provisioning PDU) are currently supported.`
        );
        return;
    }
  }

  /**
   * Network Layer.
   * Refer to Mesh Profile Specification 3.4.
   */
  private parseNetworkPDU(pdu: Uint8Array) {
    const networkPdu = pdu.subarray(1, pdu.length);

    // IV Index and NID are contained within the first octet of the Network PDU.
    // Refer to Mesh Profile Specification 3.4.4.
    const ivIndex_nid_hex = utils.u8AToHexString(networkPdu).substring(0, 2);
    const ivIndex_nid = parseInt(ivIndex_nid_hex, 16);

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
      this.meshManager.getPrivacyKey()
    );

    // Upon receiving a message, the node shall check if the value of the NID field value matches
    // one or more known NIDs. If the NID field value does not match a known NID, then the
    // message shall be ignored.
    // Refer to Mesh Profile Specification 3.4.6.3.
    if (utils.toHex(nidPdu, 1) !== this.meshManager.getNID()) {
      console.error(
        `Unknown NID ${utils.toHex(nidPdu, 1)}, application's NID: ${this.meshManager.getNID()}. \
        Discarding message.`
      );
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

    // SEQ is contained within 3 octets.
    // Refer to Mesh Profile Specification 3.8.5.1 Table 3.46.
    const seqPdu = deobfuscatedNetworkPdu.ctl_ttl_seq_src.substring(2, 8);

    // SRC is contained within 2 octets.
    // Refer to Mesh Profile Specification 3.8.5.1 Table 3.46.
    const srcPdu = deobfuscatedNetworkPdu.ctl_ttl_seq_src.substring(8, 12);

    // The encrypted part of the Network PDU contains DST (Destination Address)
    // and TransportPDU. NetMIC authenticates that the DST and
    // TransportPDU have not been changed.
    // Refer to Mesh Profile Specification 3.4.4 Figure 3.7.
    const encryptedNetworkData =
      utils.u8AToHexString(encDst) +
      utils.u8AToHexString(encTransportPdu) +
      utils.u8AToHexString(netMic);

    // Decrypt the Network PDU.
    // Refer to Mesh Profile Specification 3.8.7.2.
    const decryptedNetworkData = crypto.decryptAndVerify(
      this.meshManager.getEncryptionKey(),
      encryptedNetworkData,
      networkNonce,
      ctlInt // CTL indicates the size of NetMIC
    );
    if (!decryptedNetworkData) {
      console.error("Network data decryption failed.");
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

    return {
      dst: dstPdu,
      src: srcPdu,
      seq: seqPdu,
      ivIndex: ivIndexPdu,
      ctl: ctlInt,
      lowerTransportPDU: lowerTransportPdu,
    } as ParsedNetworkPDU;
  }

  private parseControlMessage(lowerTransportPDU: string) {
    const seg_opcode = lowerTransportPDU.substring(0, 2);
    const seg_opcodeInt = parseInt(seg_opcode, 16);

    const segInt = (seg_opcodeInt & 0x80) >> 7;

    // Refer to Mesh Profile Specification 3.5.2.3.1.
    if (seg_opcode == "00") {
      console.log(`${TAG} segment acknowledgment message`);

      const obo_seqzero_rfu = lowerTransportPDU.substring(2, 6);
      const obo_seqzero_rfuInt = parseInt(obo_seqzero_rfu, 16);

      const obo = (obo_seqzero_rfuInt & 0x8000) >> 15;
      if (obo == 0) {
        console.log(`${TAG} node directly addressed by received message `);
      } else {
        console.log(`${TAG} friend node acknowledging message on behalf of a low power node`);
      }

      const seqzero = (obo_seqzero_rfuInt & 0x7ffc) >> 2;
      return;
    }

    if (segInt == 0) {
      console.log(`${TAG} unsegmented control message`);
      return lowerTransportPDU.substring(2);
    } else {
      console.log(`${TAG} segmented control message. Not yet supported`);
      return;
    }
  }

  /**
   * Lower Transport Layer.
   * Refer to Mesh Profile Specification 3.5.
   */
  private parseLowerTransportPDU({ lowerTransportPDU, seq }: ParsedNetworkPDU) {
    // Refer to Mesh Profile Specification 3.5.2.1.
    // SEG, AKF and AID are contained within the first octet.
    const seg_akf_aid = lowerTransportPDU.substring(0, 2);
    // SEG is contained within the first bit of the first octet.
    const segInt = (parseInt(seg_akf_aid, 16) & 0x80) >> 7;
    // AKF is contained within the second bit of the first octet.
    const akfInt = (parseInt(seg_akf_aid, 16) & 0x40) >> 6;
    // AID is contained within the remaining 6 bits of the first octet.
    const aidInt = parseInt(seg_akf_aid, 16) & 0x3f;

    if (akfInt == 0 && aidInt != 0) {
      // The AKF and AID fields of the Lower Transport PDU shall be set according to the application key or
      // device key used to encrypt and authenticate the Upper Transport PDU. If an application key is used, then
      // the AKF field shall be set to 1 and the AID field shall be set to the application key identifier (AID). If the
      // device key is used, then the AKF field shall be set to 0 and the AID field shall be set to 0b000000.
      // Refer to Mesh Profile Specification 3.6.4.1.
      console.error(`Invalid LowerTransportPDU header: AKF is 0 but AID is not 0b000000`);
      return;
    }

    // Refer to Mesh Profile Specification 3.5.2 Table 3.9.
    if (segInt == 0) {
      // Unsegmented Access Message

      console.log(`Complete message.`);

      // The Upper Transport Access PDU starts at octet 1 and spans all the packet.
      // Refer to Mesh Profile Specification 3.5.2.1 Figure 3.9.
      const upperTransportAccessPdu = lowerTransportPDU.substring(2, lowerTransportPDU.length);

      return {
        upperTransportAccessPDU: upperTransportAccessPdu,
        akf: akfInt,
        isSegmented: false,
        seq: seq,
      } as ParsedLowerTransportPDU;
    } else if (segInt == 1) {
      // Segmented Access Message

      const szmic_seqzero_sego_segn = lowerTransportPDU.substring(2, 8);
      const szmic = (parseInt(szmic_seqzero_sego_segn, 16) & 0x800000) >> 23;
      const seqzer = (parseInt(szmic_seqzero_sego_segn, 16) & 0x7ffc00) >> 10;
      const sego = (parseInt(szmic_seqzero_sego_segn, 16) & 0x3e0) >> 5;
      const segn = parseInt(szmic_seqzero_sego_segn, 16) & 0x1f;

      const segment = lowerTransportPDU.substring(8);

      console.log(`Segmented message: ${sego}/${segn}, segment: ${segment}.`);

      return {
        upperTransportAccessPDU: segment,
        akf: akfInt,
        isSegmented: true,
        seq: seq,
        segn: segn,
        sego: sego,
        szmic: szmic,
      } as ParsedLowerTransportPDU;
    }
  }

  /**
   * Upper Transport Layer.
   * Refer to Mesh Profile Specification 3.6.
   */
  private parseUpperTransportAccessPDU(
    { upperTransportAccessPDU }: ParsedLowerTransportPDU,
    dst: string,
    src: string,
    seq: string,
    akf: number
  ) {
    // The Encrypted Access Payload has a variable length, but we know that for
    // unsegmented messages, the size of the TransMIC is 32 bits (4 octets) for data messages.
    // Refer to Mesh Profile Specification 3.6.2.2
    const accessPayload = upperTransportAccessPDU.substring(0, upperTransportAccessPDU.length - 8);
    // The Message Integrity Check for Transport (TransMIC) is a 32-bit or 64-bit field that
    // authenticates that the access payload has not been changed. For unsegmented messages,
    // the size of the TransMIC is 32 bits for data messages.
    // Refer to Mesh Profile Specification 3.6.2.2
    const transMic = upperTransportAccessPDU.substring(
      upperTransportAccessPDU.length - 8,
      upperTransportAccessPDU.length
    );

    let nonce = "";
    let key: string | undefined = "";
    if (akf) {
      nonce = this.PDUBuilder.makeApplicationNonce(
        parseInt(seq, 16),
        src,
        dst,
        this.meshManager.getIvIndex()
      );
      key = this.meshManager.getAppKey();
    } else {
      nonce = this.PDUBuilder.makeDeviceNonce(
        parseInt(seq, 16),
        src,
        dst,
        this.meshManager.getIvIndex(),
        false
      );
      key = this.meshManager.getNodeDevKey(src);
    }

    if (!key) {
      console.log(`Cannot decrypt access payload: src DevKey is not available`);
      return;
    }

    // For Unsegmented Access Messages the size of TransMIC is 32 bits.
    // Refer to Mesh Profile Specification 3.6.2.2.
    const decryptedAccessPayload = crypto.decryptAndVerify(
      // this.meshManager.getAppKey(),
      key!,
      accessPayload + transMic,
      nonce,
      0
    );
    if (!decryptedAccessPayload) {
      console.error("access payload decryption failed.");
      return;
    }

    return decryptedAccessPayload;
  }

  private reassembleSegmentedAccessPayload(
    segments: string[],
    key: string,
    seq: string,
    src: string,
    dst: string,
    akf: number
  ) {
    let nonce = "";
    if (akf) {
      nonce = this.PDUBuilder.makeApplicationNonce(
        parseInt(seq, 16),
        src,
        dst,
        this.meshManager.getIvIndex()
      );
    } else {
      nonce = this.PDUBuilder.makeDeviceNonce(
        parseInt(seq, 16),
        src,
        dst,
        this.meshManager.getIvIndex(),
        true
      );
    }

    const encAccessPayload = segments.join("");

    // For Unsegmented Access Messages the size of TransMIC is 64 bits.
    // Refer to Mesh Profile Specification 3.6.2.2.
    const decryptedAccessPayload = crypto.decryptAndVerify(key, encAccessPayload, nonce, 1);

    return decryptedAccessPayload;
  }

  /**
   * Extract Opcode, CompanyCode (if defined) and Parameters from an Access Payload.
   * Refer to Mesh Profile Specification 3.7.3.
   *
   * @param {string} accessPayload Access Payload.
   * @returns {AccessPayloadData} AccessPayloadData.
   */
  private parseAccessPayload = (accessPayload: string): AccessPayloadData | undefined => {
    const result: AccessPayloadData = {
      opcode: "",
      params: "",
    };

    // Minimum valid size for an Access Payload is 1 octet.
    // Refer to Mesh Profile Specification 3.7.3.
    if (accessPayload.length < 2) {
      console.error(
        `Invalid length for Access Payload. Length is ${accessPayload.length} but min length \
      is 2 (1 octet).`
      );
      return;
    }
    // Maximum valid size for an Access Payload is 380 octets.
    // Refer to Mesh Profile Specification 3.7.3.
    if (accessPayload.length > 190) {
      console.error(
        `Invalid length for Access Payload. Length is ${accessPayload.length} but max length \
      is 190 (380 octets).`
      );
      return;
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
      console.error("Opcode value is reserved for future use.");
      return;
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
}

export default PDUParser;
