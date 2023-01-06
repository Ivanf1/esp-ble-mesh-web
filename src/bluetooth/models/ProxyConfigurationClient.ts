import BluetoothManager from "../BluetoothManager";
import MeshConfigurationManager from "../MeshConfigurationManager";
import PDUBuilder, { MessageType } from "../PduBuilder";

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
  private PDUBuilder: PDUBuilder;

  constructor(configuration: ProxyConfigurationProps) {
    this.bluetoothManager = configuration.bluetoothManager;
    this.meshConfigurationManager = configuration.meshConfigurationManager;
    this.PDUBuilder = PDUBuilder.getInstance();
  }

  public setBlacklistFilter() {
    const payload = OpCode.SET_FILTER_TYPE + FilterType.BLACK_LIST;

    const proxyPDU = this.PDUBuilder.makeProxyConfigurationMessage({
      accessPayload: payload,
      ctl: ProxyConfigurationClient.ctl,
      dst: ProxyConfigurationClient.dst,
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      ivi: this.meshConfigurationManager.getIvi(),
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      NID: this.meshConfigurationManager.getNID(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
      seq: this.meshConfigurationManager.getSeq(),
      src: this.meshConfigurationManager.getProvisionerUnicastAddress(),
      ttl: ProxyConfigurationClient.ttl,
      nonceType: ProxyConfigurationClient.nonceType,
      messageType: MessageType.PROXY_CONFIGURATION,
    });

    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }
}

export default ProxyConfigurationClient;
