import {
  MakeUpperTransportPDUParams,
  MakeLowerTransportPDUParams,
  MakeSecureNetworkLayerParams,
  ObfuscateNetworkPDUInput,
  FinalizeNetworkPDUInput,
  MessageType,
} from "../pduBuilder";
import pduBuilder from "../pduBuilder";
import utils from "../../utils/utils";

enum OpCode {
  GET = "8201",
  SET = "8202",
  SET_UNACK = "8203",
}
interface GenericOnOffClientProps {
  ivIndex: string;
  netKey: string;
  appKey: string;
  src: string;
  ivi: number;
  encryptionKey: string;
  privacyKey: string;
  NID: string;
  networkId: string;
  AID: string;
}
class GenericOnOffClient {
  private static ctl: string = "0";
  private static defaultTtl: string = "07";
  private static nonceType: "network" = "network";

  private ivIndex: string = "";
  private appKey: string = "";
  private src: string = "";
  private ivi: number = 0;
  private encryptionKey: string = "";
  private privacyKey: string = "";
  private NID: string = "";
  private AID: string = "";

  constructor(configuration: GenericOnOffClientProps) {
    this.ivIndex = configuration.ivIndex;
    this.appKey = configuration.appKey;
    this.src = configuration.src;
    this.ivi = configuration.ivi;
    this.encryptionKey = configuration.encryptionKey;
    this.privacyKey = configuration.privacyKey;
    this.NID = configuration.NID;
    this.AID = configuration.AID;
  }

  public makeSetMessage(on: boolean, dst: string, seq: number, ttl?: string) {
    return this.makeMessage(OpCode.SET, on, dst, seq, ttl);
  }

  public makeSetUnackMessage(on: boolean, dst: string, seq: number, ttl?: string) {
    return this.makeMessage(OpCode.SET_UNACK, on, dst, seq, ttl);
  }

  private makeMessage(opCode: OpCode, on: boolean, dst: string, seq: number, ttl?: string) {
    const params = (on ? "01" : "00") + utils.toHex(seq, 1);
    const accessPayload = pduBuilder.makeAccessPayload(opCode, params);

    const upperTransportPDUInputParams: MakeUpperTransportPDUParams = {
      seq: seq,
      src: this.src,
      dst: dst,
      ivIndex: this.ivIndex,
      appKey: this.appKey,
      accessPayload,
    };
    const upperTransportPDU = pduBuilder.makeUpperTransportPDU(upperTransportPDUInputParams);

    const lowerTransportPDUInputParams: MakeLowerTransportPDUParams = {
      AID: this.AID,
      upperTransportPDU: upperTransportPDU,
    };
    const lowerTransportPDU = pduBuilder.makeLowerTransportPDU(lowerTransportPDUInputParams);

    const securedNetworkPDUInputParams: MakeSecureNetworkLayerParams = {
      encryptionKey: this.encryptionKey,
      dst: dst,
      lowerTransportPDU,
      ctl: GenericOnOffClient.ctl,
      ttl: ttl ? ttl : GenericOnOffClient.defaultTtl,
      seq: seq,
      src: this.src,
      ivIndex: this.ivIndex,
      nonceType: GenericOnOffClient.nonceType,
    };
    const securedNetworkPDU = pduBuilder.makeSecureNetworkLayer(securedNetworkPDUInputParams);

    const obfuscateNetworkPDUInputParams: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDU,
      ctl: GenericOnOffClient.ctl,
      ttl: ttl ? ttl : GenericOnOffClient.defaultTtl,
      seq: seq,
      src: this.src,
      ivIndex: this.ivIndex,
      privacyKey: this.privacyKey,
    };
    const obfuscated = pduBuilder.obfuscateNetworkPDU(obfuscateNetworkPDUInputParams);

    const finalizedNetworkPDUInputParams: FinalizeNetworkPDUInput = {
      ivi: this.ivi,
      nid: this.NID,
      obfuscated_ctl_ttl_seq_src: obfuscated.obfuscated_ctl_ttl_seq_src,
      encDst: securedNetworkPDU.EncDST,
      encTransportPdu: securedNetworkPDU.EncTransportPDU,
      netmic: securedNetworkPDU.NetMIC,
    };
    const finalizedNetworkPDU = pduBuilder.finalizeNetworkPDU(finalizedNetworkPDUInputParams);

    const proxyPDU = pduBuilder.finalizeProxyPDU(finalizedNetworkPDU, MessageType.NETWORK_PDU);

    return proxyPDU;
  }
}

export default GenericOnOffClient;
