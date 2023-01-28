import utils from "../../utils/utils";
import BluetoothManager from "../BluetoothManager";
import MeshConfigurationManager, { NodeComposition } from "../MeshConfigurationManager";
import PDUBuilder, { MessageType } from "../PduBuilder";
import { AccessPayloadData, ProxyPDU } from "../PduParser";

const TAG = "CONFIG CLIENT";

enum OpCode {
  APPKEY_ADD = "00",
  APPKEY_STATUS = "8003",
  COMPOSITION_DATA_GET = "8008",
  COMPOSITION_DATA_STATUS = "02",
  MODEL_APP_BIND = "803d",
  MODEL_APP_STATUS = "803e",
  MODEL_PUBLICATION_SET = "03",
  MODEL_PUBLICATION_STATUS = "8019",
  MODEL_SUBSCRIPTION_ADD = "801b",
  MODEL_SUBSCRIPTION_STATUS = "801f",
}

export interface ConfigClientStatusUpdate {
  type: string;
  error?: boolean;
}
type StatusUpdateCallback = (status: ConfigClientStatusUpdate) => void;
interface ConfigClientProps {
  bluetoothManager: BluetoothManager;
  meshConfigurationManager: MeshConfigurationManager;
}
class ConfigClient {
  private bluetoothManager: BluetoothManager;
  private meshConfigurationManager: MeshConfigurationManager;
  private PDUBuilder: PDUBuilder;

  private statusUpdatesCallbacks: Map<string, StatusUpdateCallback>;

  constructor(props: ConfigClientProps) {
    this.bluetoothManager = props.bluetoothManager;
    this.meshConfigurationManager = props.meshConfigurationManager;
    this.bluetoothManager.registerProxyPDUNotificationCallback(
      (pdu) => this.onConfigMessageReceived(pdu),
      MessageType.NETWORK_PDU
    );
    this.PDUBuilder = PDUBuilder.getInstance();
    this.statusUpdatesCallbacks = new Map();
  }

  public registerStatusUpdateCallback(id: string, callback: StatusUpdateCallback) {
    this.statusUpdatesCallbacks.set(id, callback);
    console.log("register");
  }
  public removeStatusUpdateCallback(id: string) {
    if (!this.statusUpdatesCallbacks.has(id)) return;
    this.statusUpdatesCallbacks.delete(id);
    console.log("unregister");
  }

  addAppKey(dst: string) {
    const devKey = this.meshConfigurationManager.getNodeDevKey(dst);
    if (!devKey) {
      console.log(`No node in mesh with address: ${dst}`);
      return;
    }

    const accessPayload = this.PDUBuilder.makeAccessPayload(
      OpCode.APPKEY_ADD,
      "000000" + this.meshConfigurationManager.getAppKey()
    );

    const proxyPDUs = this.PDUBuilder.makeSegmentedAccessMessage({
      accessPayload,
      AID: this.meshConfigurationManager.getAID(),
      ctl: "00",
      dst: dst,
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      ivi: this.meshConfigurationManager.getIvi(),
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      keyType: "device",
      NID: this.meshConfigurationManager.getNID(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
      seq: this.meshConfigurationManager.getSeq(),
      src: this.meshConfigurationManager.getProvisionerUnicastAddress(),
      nonceType: "network",
      ttl: this.meshConfigurationManager.getDefaultTTLForNode(dst) ?? "05",
      messageType: MessageType.NETWORK_PDU,
    });

    for (let i = 0; i < proxyPDUs.length; i++) {
      this.bluetoothManager.sendProxyPDU(proxyPDUs[i]);
    }
  }

  modelAppKeyBind(nodeAddress: string, elementAddress: string, modelId: string) {
    const devKey = this.meshConfigurationManager.getNodeDevKey(nodeAddress);
    if (!devKey) {
      console.log(`No node in mesh with address: ${nodeAddress}`);
      return;
    }

    const accessPayload = this.PDUBuilder.makeAccessPayload(
      OpCode.MODEL_APP_BIND,
      utils.swapHexEndianness(elementAddress) +
        utils.swapHexEndianness("0000") +
        utils.swapHexEndianness(modelId)
    );

    const proxyPDU = this.PDUBuilder.makeUnsegmentedAccessMessage({
      accessPayload: accessPayload,
      AID: this.meshConfigurationManager.getAID(),
      ctl: "00",
      dst: nodeAddress,
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      ivi: this.meshConfigurationManager.getIvi(),
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      keyType: "device",
      NID: this.meshConfigurationManager.getNID(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
      seq: this.meshConfigurationManager.getSeq(),
      src: this.meshConfigurationManager.getProvisionerUnicastAddress(),
      ttl: "05",
      nonceType: "network",
      messageType: MessageType.NETWORK_PDU,
    });

    console.log(`sending config AppKey bind: ${proxyPDU}`);
    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }

  modelPublicationSet(
    nodeAddress: string,
    elementAddress: string,
    publishAddress: string,
    modelId: string
  ) {
    const devKey = this.meshConfigurationManager.getNodeDevKey(nodeAddress);
    if (!devKey) {
      console.log(`No node in mesh with address: ${nodeAddress}`);
      return;
    }

    const accessPayload = this.PDUBuilder.makeAccessPayload(
      OpCode.MODEL_PUBLICATION_SET,
      utils.swapHexEndianness(elementAddress) +
        utils.swapHexEndianness(publishAddress) +
        utils.swapHexEndianness("0000") +
        utils.swapHexEndianness("05") +
        utils.swapHexEndianness("00") +
        utils.swapHexEndianness("00") +
        utils.swapHexEndianness(modelId)
    );

    const proxyPDU = this.PDUBuilder.makeUnsegmentedAccessMessage({
      accessPayload: accessPayload,
      AID: this.meshConfigurationManager.getAID(),
      ctl: "00",
      dst: nodeAddress,
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      ivi: this.meshConfigurationManager.getIvi(),
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      keyType: "device",
      NID: this.meshConfigurationManager.getNID(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
      seq: this.meshConfigurationManager.getSeq(),
      src: this.meshConfigurationManager.getProvisionerUnicastAddress(),
      ttl: "05",
      nonceType: "network",
      messageType: MessageType.NETWORK_PDU,
    });

    console.log(`sending config model publication set: ${proxyPDU}`);
    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }

  modelSubscriptionAdd(
    nodeAddress: string,
    elementAddress: string,
    subscriptionAddress: string,
    modelId: string
  ) {
    const devKey = this.meshConfigurationManager.getNodeDevKey(nodeAddress);
    if (!devKey) {
      console.log(`No node in mesh with address: ${nodeAddress}`);
      return;
    }

    const accessPayload = this.PDUBuilder.makeAccessPayload(
      OpCode.MODEL_SUBSCRIPTION_ADD,
      utils.swapHexEndianness(elementAddress) +
        utils.swapHexEndianness(subscriptionAddress) +
        utils.swapHexEndianness(modelId)
    );

    const proxyPDU = this.PDUBuilder.makeUnsegmentedAccessMessage({
      accessPayload: accessPayload,
      AID: this.meshConfigurationManager.getAID(),
      ctl: "00",
      dst: nodeAddress,
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      ivi: this.meshConfigurationManager.getIvi(),
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      keyType: "device",
      NID: this.meshConfigurationManager.getNID(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
      seq: this.meshConfigurationManager.getSeq(),
      src: this.meshConfigurationManager.getProvisionerUnicastAddress(),
      ttl: "05",
      nonceType: "network",
      messageType: MessageType.NETWORK_PDU,
    });

    console.log(`sending config model subscription add: ${proxyPDU}`);
    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }

  getCompositionData(id: string) {
    const node = this.meshConfigurationManager.getNodeById(id);
    if (!node) return;

    const accessPayload = this.PDUBuilder.makeAccessPayload(
      OpCode.COMPOSITION_DATA_GET,
      utils.swapHexEndianness("00")
    );

    const proxyPDU = this.PDUBuilder.makeUnsegmentedAccessMessage({
      accessPayload: accessPayload,
      AID: this.meshConfigurationManager.getAID(),
      ctl: "00",
      dst: node.unicastAddress,
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      ivi: this.meshConfigurationManager.getIvi(),
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: node.deviceKey,
      keyType: "device",
      NID: this.meshConfigurationManager.getNID(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
      seq: this.meshConfigurationManager.getSeq(),
      src: this.meshConfigurationManager.getProvisionerUnicastAddress(),
      ttl: "05",
      nonceType: "network",
      messageType: MessageType.NETWORK_PDU,
    });

    console.log(`sending config get composition data: ${proxyPDU}`);
    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }

  onConfigMessageReceived(pdu: ProxyPDU) {
    this.parseConfigMessage(pdu.data, pdu.src!);
  }

  private parseConfigMessage(pdu: AccessPayloadData, src: string) {
    let status = "";

    switch (pdu.opcode as OpCode) {
      case OpCode.COMPOSITION_DATA_STATUS:
        const nodeComposition = this.parseCompositionData(pdu.params);
        this.meshConfigurationManager.addNodeComposition(src, nodeComposition);

        this.statusUpdatesCallbacks.forEach((c) => c({ type: "composition_data", error: false }));
        break;

      case OpCode.APPKEY_STATUS:
        status = pdu.params.substring(0, 2);
        if (status == "00") {
          console.log(`appkey add successful`);
        } else {
          console.log(`appkey add error`);
        }
        this.statusUpdatesCallbacks.forEach((c) =>
          c({ type: "appkey_add", error: status != "00" })
        );
        break;

      case OpCode.MODEL_APP_STATUS:
        status = pdu.params.substring(0, 2);
        if (status == "00") {
          console.log(`appkey bind successful`);
        } else {
          console.log(`appkey bind error`);
        }
        this.statusUpdatesCallbacks.forEach((c) =>
          c({ type: "appkey_bind", error: status != "00" })
        );
        break;

      case OpCode.MODEL_PUBLICATION_STATUS:
        status = pdu.params.substring(0, 2);
        if (status == "00") {
          console.log(`publication set successful`);
        } else {
          console.log(`publication set error`);
        }
        this.statusUpdatesCallbacks.forEach((c) => c({ type: "pub_set", error: status != "00" }));
        break;

      case OpCode.MODEL_SUBSCRIPTION_STATUS:
        status = pdu.params.substring(0, 2);
        if (status == "00") {
          console.log(`subscription add successful`);
        } else {
          console.log(`subscription add error`);
        }
        this.statusUpdatesCallbacks.forEach((c) => c({ type: "sub_add", error: status != "00" }));
        break;

      default:
        break;
    }
  }

  /**
   * Refer to Mesh Profile Specification 4.2.1.1.
   */
  private parseCompositionData(data: string) {
    console.log(`${TAG}: received composition data status: ${data}`);

    const pageNumber = data.substring(0, 2);
    const cd = data.substring(2);

    const cid = utils.swapHexEndianness(cd.substring(0, 4));
    const pid = utils.swapHexEndianness(cd.substring(4, 8));
    const vid = utils.swapHexEndianness(cd.substring(8, 12));
    const crpl = utils.swapHexEndianness(cd.substring(12, 16));
    const features = utils.swapHexEndianness(cd.substring(16, 20));
    const featuresInt = parseInt(features, 16);

    const relayFeature = (featuresInt & 0x0001) !== 0;
    const proxyFeature = (featuresInt & 0x0002) !== 0;
    const friendFeature = (featuresInt & 0x0004) !== 0;
    const lowPowerFeature = (featuresInt & 0x0008) !== 0;

    let elements = cd.substring(20);
    const nodeComposition: NodeComposition = {
      cid: cid,
      pid: pid,
      vid: vid,
      crpl: crpl,
      relay: relayFeature,
      proxy: proxyFeature,
      friend: friendFeature,
      lowPower: lowPowerFeature,
      elements: [],
    };

    do {
      const location = elements.substring(0, 4);
      const numSigModels = parseInt(elements.substring(4, 6), 16);
      const numVendorModels = parseInt(elements.substring(6, 8), 16);
      const models = elements.substring(8);

      let sigModels: string[] = [];
      if (numSigModels !== 0) {
        sigModels = utils.splitHexStringChunksOfSizeX(models.substring(0, numSigModels * 4), 4)!;
        sigModels = sigModels!.map((m) => utils.swapHexEndianness(m));
      }
      let vendorModels: string[] = [];
      if (numVendorModels !== 0) {
        vendorModels = utils.splitHexStringChunksOfSizeX(
          models.substring(0, numVendorModels * 8),
          8
        )!;
        vendorModels = vendorModels!.map((m) => utils.swapHexEndianness(m));
      }

      nodeComposition.elements.push({
        location: location,
        sigModels: sigModels,
        vendorModels: vendorModels,
      });

      const elementLength = 4 + 2 + 2 + numSigModels * 4 + numVendorModels * 8;
      elements = elements.substring(elementLength);
    } while (elements.length > 0);

    return nodeComposition;
  }
}

export default ConfigClient;
