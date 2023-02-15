import utils from "../../utils/utils";
import BluetoothManager from "../BluetoothManager";
import MeshConfigurationManager from "../MeshConfigurationManager";
import PDUBuilder, { MessageType } from "../PduBuilder";
import { AccessPayloadData, ProxyPDU } from "../PduParser";

const TAG = "WIFI CONFIG";

enum OpCode {
  SET = "c0e502",
  STATUS = "c1",
}
enum WiFiConfigResult {
  OK = "0000",
}
enum WiFiConfigFailedReason {
  INVALID_LENGTH = "0001",
  OUT_OF_MEMORY = "0002",
  NO_SEPARATOR = "0003",
  INVALID_PARAMETERS_LENGTH = "0004",
}
export interface WiFiConfigClientStatusUpdate {
  error: boolean;
  message?: string;
}
type StatusUpdateCallback = (status: WiFiConfigClientStatusUpdate) => void;
interface WiFiConfigClientProps {
  bluetoothManager: BluetoothManager;
  meshConfigurationManager: MeshConfigurationManager;
}
class WiFiConfigClient {
  private static ctl: string = "0";
  private static defaultTtl: string = "07";
  private static nonceType: "network" = "network";
  private static keyType: "app" = "app";
  private static separator: "2e" = "2e"; // 2e = "." in ASCII, . is used as separator

  private bluetoothManager: BluetoothManager;
  private meshConfigurationManager: MeshConfigurationManager;
  private PDUBuilder: PDUBuilder;
  private statusUpdatesCallbacks: Map<string, StatusUpdateCallback>;

  constructor(configuration: WiFiConfigClientProps) {
    this.bluetoothManager = configuration.bluetoothManager;
    this.meshConfigurationManager = configuration.meshConfigurationManager;
    this.bluetoothManager.registerProxyPDUNotificationCallback(
      (pdu) => this.onWiFiConfigMessageReceived(pdu),
      MessageType.NETWORK_PDU
    );
    this.PDUBuilder = PDUBuilder.getInstance();
    this.statusUpdatesCallbacks = new Map();
  }

  public registerStatusUpdateCallback(id: string, callback: StatusUpdateCallback) {
    this.statusUpdatesCallbacks.set(id, callback);
  }
  public removeStatusUpdateCallback(id: string) {
    if (!this.statusUpdatesCallbacks.has(id)) return;
    this.statusUpdatesCallbacks.delete(id);
  }

  public sendSetMessage(ssid: string, password: string, dst: string, ttl?: string) {
    const seq = this.meshConfigurationManager.getSeq();

    const params =
      utils.stringToHex(ssid) + WiFiConfigClient.separator + utils.stringToHex(password);

    const accessPayload = this.PDUBuilder.makeAccessPayload(OpCode.SET, params);

    const proxyPDUs = this.PDUBuilder.makeSegmentedAccessMessage({
      accessPayload: accessPayload,
      dst: dst,
      seq: seq,
      ctl: WiFiConfigClient.ctl,
      ttl: ttl ?? WiFiConfigClient.defaultTtl,
      nonceType: WiFiConfigClient.nonceType,
      AID: this.meshConfigurationManager.getAID(),
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      ivi: this.meshConfigurationManager.getIvi(),
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: this.meshConfigurationManager.getAppKey(),
      keyType: WiFiConfigClient.keyType,
      NID: this.meshConfigurationManager.getNID(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
      src: this.meshConfigurationManager.getProvisionerUnicastAddress(),
      messageType: MessageType.NETWORK_PDU,
    });

    for (let i = 0; i < proxyPDUs.length; i++) {
      this.bluetoothManager.sendProxyPDU(proxyPDUs[i]);
    }
  }

  onWiFiConfigMessageReceived(pdu: ProxyPDU) {
    this.parseWiFiConfigMessage(pdu.data, pdu.src!);
  }

  private parseWiFiConfigMessage(pdu: AccessPayloadData, src: string) {
    const param = utils.swapHexEndianness(pdu.params);
    switch (pdu.opcode as OpCode) {
      case OpCode.STATUS:
        console.log(`${TAG}: received wifi config status`);
        if (param != WiFiConfigResult.OK) {
          this.parseFailedReason(param as WiFiConfigFailedReason);
          return;
        }
        console.log(`${TAG}: wifi config status ok`);
        this.statusUpdatesCallbacks.forEach((c) => {
          c({ error: false });
        });
    }
  }

  private parseFailedReason(failureReason: WiFiConfigFailedReason) {
    let message = "";

    switch (failureReason) {
      case WiFiConfigFailedReason.INVALID_LENGTH:
        console.error(`${TAG}: wifi config failed: invalid message length`);
        message = "invalid message length";
        break;
      case WiFiConfigFailedReason.OUT_OF_MEMORY:
        console.error(`${TAG}: wifi config failed: out of memory`);
        message = "out of memory";
        break;
      case WiFiConfigFailedReason.NO_SEPARATOR:
        console.error(`${TAG}: wifi config failed: no separator`);
        message = "no separator";
        break;
      case WiFiConfigFailedReason.INVALID_PARAMETERS_LENGTH:
        console.error(`${TAG}: wifi config failed: invalid parameters length`);
        message = "invalid parameters length";
        break;
      default:
        break;
    }

    this.statusUpdatesCallbacks.forEach((c) => {
      c({ error: true, message });
    });
  }
}

export default WiFiConfigClient;
