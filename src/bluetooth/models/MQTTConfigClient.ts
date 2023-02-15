import utils from "../../utils/utils";
import BluetoothManager from "../BluetoothManager";
import MeshConfigurationManager from "../MeshConfigurationManager";
import PDUBuilder, { MessageType } from "../PduBuilder";
import { ProxyPDU, AccessPayloadData } from "../PduParser";

const TAG = "MQTT CONFIG";

enum OpCode {
  SET = "c2e502",
  STATUS = "c3",
}
enum MQTTConfigResult {
  OK = "0000",
}
enum MQTTConfigFailedReason {
  INVALID_LENGTH = "0001",
  OUT_OF_MEMORY = "0002",
  INVALID_PARAMETERS = "0003",
}
interface MQTTConfigClientProps {
  bluetoothManager: BluetoothManager;
  meshConfigurationManager: MeshConfigurationManager;
}
class MQTTConfigClient {
  private static ctl: string = "0";
  private static defaultTtl: string = "07";
  private static nonceType: "network" = "network";
  private static keyType: "app" = "app";
  private static separator: "7c" = "7c"; // 7c = "|" in ASCII, | is used as separator

  private bluetoothManager: BluetoothManager;
  private meshConfigurationManager: MeshConfigurationManager;
  private PDUBuilder: PDUBuilder;

  constructor(configuration: MQTTConfigClientProps) {
    this.bluetoothManager = configuration.bluetoothManager;
    this.meshConfigurationManager = configuration.meshConfigurationManager;
    this.bluetoothManager.registerProxyPDUNotificationCallback(
      (pdu) => this.onMQTTConfigMessageReceived(pdu),
      MessageType.NETWORK_PDU
    );
    this.PDUBuilder = PDUBuilder.getInstance();
  }

  public sendSetMessage(
    uri: string,
    username: string,
    password: string,
    dst: string,
    ttl?: string
  ) {
    const seq = this.meshConfigurationManager.getSeq();

    const params =
      utils.stringToHex(uri) +
      MQTTConfigClient.separator +
      utils.stringToHex(username) +
      MQTTConfigClient.separator +
      utils.stringToHex(password);

    const accessPayload = this.PDUBuilder.makeAccessPayload(OpCode.SET, params);

    const proxyPDUs = this.PDUBuilder.makeSegmentedAccessMessage({
      accessPayload: accessPayload,
      dst: dst,
      seq: seq,
      ctl: MQTTConfigClient.ctl,
      ttl: ttl ?? MQTTConfigClient.defaultTtl,
      nonceType: MQTTConfigClient.nonceType,
      AID: this.meshConfigurationManager.getAID(),
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      ivi: this.meshConfigurationManager.getIvi(),
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: this.meshConfigurationManager.getAppKey(),
      keyType: MQTTConfigClient.keyType,
      NID: this.meshConfigurationManager.getNID(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
      src: this.meshConfigurationManager.getProvisionerUnicastAddress(),
      messageType: MessageType.NETWORK_PDU,
    });

    for (let i = 0; i < proxyPDUs.length; i++) {
      this.bluetoothManager.sendProxyPDU(proxyPDUs[i]);
    }
  }

  onMQTTConfigMessageReceived(pdu: ProxyPDU) {
    this.parseMQTTConfigMessage(pdu.data, pdu.src!);
  }

  private parseMQTTConfigMessage(pdu: AccessPayloadData, src: string) {
    const param = utils.swapHexEndianness(pdu.params);
    switch (pdu.opcode as OpCode) {
      case OpCode.STATUS:
        console.log(`${TAG}: received mqtt config status`);
        if (param != MQTTConfigResult.OK) {
          this.parseFailedReason(param as MQTTConfigFailedReason);
          return;
        }
        console.log(`${TAG}: mqtt config status ok`);
    }
  }

  private parseFailedReason(failureReason: MQTTConfigFailedReason) {
    let message = "";

    switch (failureReason) {
      case MQTTConfigFailedReason.INVALID_LENGTH:
        console.error(`${TAG}: mqtt config failed: invalid message length`);
        message = "invalid message length";
        break;
      case MQTTConfigFailedReason.OUT_OF_MEMORY:
        console.error(`${TAG}: mqtt config failed: out of memory`);
        message = "out of memory";
        break;
      case MQTTConfigFailedReason.INVALID_PARAMETERS:
        console.error(`${TAG}: mqtt config failed: invalid parameters`);
        message = "invalid parameters";
        break;
      default:
        break;
    }
  }
}

export default MQTTConfigClient;
