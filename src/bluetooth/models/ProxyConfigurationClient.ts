import pduBuilder, {
  MakeSecureNetworkLayerParams,
  ObfuscateNetworkPDUInput,
  FinalizeNetworkPDUInput,
  MessageType,
} from "../pduBuilder";

enum OpCode {
  SET_FILTER_TYPE = "00",
}
enum FilterType {
  WHITE_LIST = "00",
  BLACK_LIST = "01",
}
interface ProxyConfigurationProps {
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
class ProxyConfigurationClient {
  private static ctl: string = "1";
  private static ttl: string = "0";
  private static nonceType: "proxy" = "proxy";
  private static dst: string = "0000";

  private ivIndex: string = "";
  private src: string = "";
  private ivi: number = 0;
  private encryptionKey: string = "";
  private privacyKey: string = "";
  private NID: string = "";

  constructor(configuration: ProxyConfigurationProps) {
    this.ivIndex = configuration.ivIndex;
    this.src = configuration.src;
    this.ivi = configuration.ivi;
    this.encryptionKey = configuration.encryptionKey;
    this.privacyKey = configuration.privacyKey;
    this.NID = configuration.NID;
  }

  makeBlacklistFilterPDU(seq: number) {
    const payload = OpCode.SET_FILTER_TYPE + FilterType.BLACK_LIST;

    const securedNetworkPDUInputParams: MakeSecureNetworkLayerParams = {
      encryptionKey: this.encryptionKey,
      dst: ProxyConfigurationClient.dst,
      lowerTransportPDU: payload,
      seq: seq,
      src: this.src,
      ivIndex: this.ivIndex,
      nonceType: ProxyConfigurationClient.nonceType,
    };
    const securedNetworkPDU = pduBuilder.makeSecureNetworkLayer(securedNetworkPDUInputParams);

    const obfuscateNetworkPDUInputParams: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDU,
      ctl: ProxyConfigurationClient.ctl,
      ttl: ProxyConfigurationClient.ttl,
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

    const proxyPDU = pduBuilder.finalizeProxyPDU(
      finalizedNetworkPDU,
      MessageType.PROXY_CONFIGURATION
    );

    return proxyPDU;
  }
}

export default ProxyConfigurationClient;
