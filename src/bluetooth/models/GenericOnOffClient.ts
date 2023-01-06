import PDUBuilder, { MessageType } from "../PduBuilder";
import utils from "../../utils/utils";
import MeshConfigurationManager from "../MeshConfigurationManager";
import BluetoothManager from "../BluetoothManager";

enum OpCode {
  GET = "8201",
  SET = "8202",
  SET_UNACK = "8203",
}
interface GenericOnOffClientProps {
  bluetoothManager: BluetoothManager;
  meshConfigurationManager: MeshConfigurationManager;
}
class GenericOnOffClient {
  private static ctl: string = "0";
  private static defaultTtl: string = "07";
  private static nonceType: "network" = "network";
  private static keyType: "app" = "app";

  private bluetoothManager: BluetoothManager;
  private meshConfigurationManager: MeshConfigurationManager;
  private PDUBuilder: PDUBuilder;

  constructor(configuration: GenericOnOffClientProps) {
    this.bluetoothManager = configuration.bluetoothManager;
    this.meshConfigurationManager = configuration.meshConfigurationManager;
    this.PDUBuilder = PDUBuilder.getInstance();
  }

  public sendSetMessage(on: boolean, dst: string, ttl?: string) {
    this.sendMessage(OpCode.SET, on, dst, ttl);
  }
  public sendSetUnackMessage(on: boolean, dst: string, ttl?: string) {
    this.sendMessage(OpCode.SET_UNACK, on, dst, ttl);
  }

  private sendMessage(opCode: OpCode, on: boolean, dst: string, ttl?: string) {
    const seq = this.meshConfigurationManager.getSeq();

    const params = (on ? "01" : "00") + utils.toHex(seq, 1);
    const accessPayload = this.PDUBuilder.makeAccessPayload(opCode, params);

    const proxyPDU = this.PDUBuilder.makeUnsegmentedAccessMessage({
      accessPayload: accessPayload,
      dst: dst,
      seq: seq,
      ctl: GenericOnOffClient.ctl,
      ttl: ttl ?? GenericOnOffClient.defaultTtl,
      nonceType: GenericOnOffClient.nonceType,
      AID: this.meshConfigurationManager.getAID(),
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      ivi: this.meshConfigurationManager.getIvi(),
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: this.meshConfigurationManager.getAppKey(),
      keyType: GenericOnOffClient.keyType,
      NID: this.meshConfigurationManager.getNID(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
      src: this.meshConfigurationManager.getProvisionerUnicastAddress(),
      messageType: MessageType.NETWORK_PDU,
    });

    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }
}

export default GenericOnOffClient;
