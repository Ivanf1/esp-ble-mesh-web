import BluetoothManager from "../BluetoothManager";
import MeshConfigurationManager from "../MeshConfigurationManager";
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
  bluetoothManager: BluetoothManager;
  meshConfigurationManager: MeshConfigurationManager;
}
class ProxyConfigurationClient {
  private static ctl: string = "1";
  private static ttl: string = "0";
  private static nonceType: "proxy" = "proxy";
  private static dst: string = "0000";

  private bluetoothManager: BluetoothManager;
  private meshConfigurationManager: MeshConfigurationManager;

  constructor(configuration: ProxyConfigurationProps) {
    this.bluetoothManager = configuration.bluetoothManager;
    this.meshConfigurationManager = configuration.meshConfigurationManager;
  }

  public setBlacklistFilter() {
    const seq = this.meshConfigurationManager.getSeq();
    const src = this.meshConfigurationManager.getProvisionerUnicastAddress();
    const ivIndex = this.meshConfigurationManager.getIvIndex();

    const payload = OpCode.SET_FILTER_TYPE + FilterType.BLACK_LIST;

    const securedNetworkPDUInputParams: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: ProxyConfigurationClient.dst,
      lowerTransportPDU: payload,
      seq: seq,
      src: src,
      ivIndex: ivIndex,
      nonceType: ProxyConfigurationClient.nonceType,
    };
    const securedNetworkPDU = pduBuilder.makeSecureNetworkLayer(securedNetworkPDUInputParams);

    const obfuscateNetworkPDUInputParams: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDU,
      ctl: ProxyConfigurationClient.ctl,
      ttl: ProxyConfigurationClient.ttl,
      seq: seq,
      src: src,
      ivIndex: ivIndex,
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
    };
    const obfuscated = pduBuilder.obfuscateNetworkPDU(obfuscateNetworkPDUInputParams);

    const finalizedNetworkPDUInputParams: FinalizeNetworkPDUInput = {
      ivi: this.meshConfigurationManager.getIvi(),
      nid: this.meshConfigurationManager.getNID(),
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

    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }
}

export default ProxyConfigurationClient;
