import utils from "../../utils/utils";
import BluetoothManager from "../BluetoothManager";
import MeshConfigurationManager, { NodeComposition } from "../MeshConfigurationManager";
import pduBuilder, {
  MakeUpperTransportPDUParams,
  MakeSegmentedLowerTransportPDUParams,
  MakeSecureNetworkLayerParams,
  ObfuscateNetworkPDUInput,
  FinalizeNetworkPDUInput,
  MessageType,
  MakeLowerTransportPDUParams,
} from "../pduBuilder";
import { AccessPayloadData, ProxyPDU } from "../PduParser";

const TAG = "CONFIG CLIENT";

enum OpCode {
  APPKEY_ADD = "00",
  COMPOSITION_DATA_GET = "8008",
  COMPOSITION_DATA_STATUS = "02",
  MODEL_APP_BIND = "803d",
  MODEL_PUBLICATION_SET = "03",
  MODEL_SUBSCRIPTION_ADD = "801b",
}

interface ConfigClientProps {
  bluetoothManager: BluetoothManager;
  meshConfigurationManager: MeshConfigurationManager;
}
class ConfigClient {
  private bluetoothManager: BluetoothManager;
  private meshConfigurationManager: MeshConfigurationManager;

  constructor(props: ConfigClientProps) {
    this.bluetoothManager = props.bluetoothManager;
    this.meshConfigurationManager = props.meshConfigurationManager;
    this.bluetoothManager.registerProxyPDUNotificationCallback(
      (pdu) => this.onConfigMessageReceived(pdu),
      MessageType.NETWORK_PDU
    );
  }

  addAppKey(dst: string) {
    const devKey = this.meshConfigurationManager.getNodeDevKey(dst);
    if (!devKey) return;

    const seq = this.meshConfigurationManager.getSeq();

    const accessPayload = pduBuilder.makeAccessPayload(
      OpCode.APPKEY_ADD,
      "000000" + this.meshConfigurationManager.getAppKey()
    );

    const upperTransportPDUInputParams: MakeUpperTransportPDUParams = {
      seq: seq,
      src: "0001",
      dst: dst,
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      accessPayload,
      keyType: "device",
    };
    const [upperTransportPDUSeg0, upperTransportPDUSeg1] =
      pduBuilder.makeSegmentedUpperTransportPDU(upperTransportPDUInputParams);

    const lowerTransportPDUInputParamsSeg0: MakeSegmentedLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDUSeg0,
      isAppKey: false,
      segN: 1,
      segO: 0,
      seq: seq,
    };
    const lowerTransportPDUSeg0 = pduBuilder.makeSegmentedLowerTransportPDU(
      lowerTransportPDUInputParamsSeg0
    );
    const lowerTransportPDUInputParamsSeg1: MakeSegmentedLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDUSeg1,
      isAppKey: false,
      segN: 1,
      segO: 1,
      seq: seq,
    };
    const lowerTransportPDUSeg1 = pduBuilder.makeSegmentedLowerTransportPDU(
      lowerTransportPDUInputParamsSeg1
    );

    const securedNetworkPDUInputParamsSeg0: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: dst,
      lowerTransportPDU: lowerTransportPDUSeg0,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      nonceType: "network",
    };
    const securedNetworkPDUSeg0 = pduBuilder.makeSecureNetworkLayer(
      securedNetworkPDUInputParamsSeg0
    );
    const securedNetworkPDUInputParamsSeg1: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: dst,
      lowerTransportPDU: lowerTransportPDUSeg1,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      nonceType: "network",
    };
    const securedNetworkPDUSeg1 = pduBuilder.makeSecureNetworkLayer(
      securedNetworkPDUInputParamsSeg1
    );

    const obfuscateNetworkPDUInputParamsSeg0: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDUSeg0,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
    };
    const obfuscatedSeg0 = pduBuilder.obfuscateNetworkPDU(obfuscateNetworkPDUInputParamsSeg0);
    const obfuscateNetworkPDUInputParamsSeg1: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDUSeg1,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
    };
    const obfuscatedSeg1 = pduBuilder.obfuscateNetworkPDU(obfuscateNetworkPDUInputParamsSeg1);

    const finalizedNetworkPDUInputParamsSeg0: FinalizeNetworkPDUInput = {
      ivi: this.meshConfigurationManager.getIvi(),
      nid: this.meshConfigurationManager.getNID(),
      obfuscated_ctl_ttl_seq_src: obfuscatedSeg0.obfuscated_ctl_ttl_seq_src,
      encDst: securedNetworkPDUSeg0.EncDST,
      encTransportPdu: securedNetworkPDUSeg0.EncTransportPDU,
      netmic: securedNetworkPDUSeg0.NetMIC,
    };
    const finalizedNetworkPDUSeg0 = pduBuilder.finalizeNetworkPDU(
      finalizedNetworkPDUInputParamsSeg0
    );
    const finalizedNetworkPDUInputParamsSeg1: FinalizeNetworkPDUInput = {
      ivi: this.meshConfigurationManager.getIvi(),
      nid: this.meshConfigurationManager.getNID(),
      obfuscated_ctl_ttl_seq_src: obfuscatedSeg1.obfuscated_ctl_ttl_seq_src,
      encDst: securedNetworkPDUSeg1.EncDST,
      encTransportPdu: securedNetworkPDUSeg1.EncTransportPDU,
      netmic: securedNetworkPDUSeg1.NetMIC,
    };
    const finalizedNetworkPDUSeg1 = pduBuilder.finalizeNetworkPDU(
      finalizedNetworkPDUInputParamsSeg1
    );

    const proxyPDUSeg0 = pduBuilder.finalizeProxyPDU(
      finalizedNetworkPDUSeg0,
      MessageType.NETWORK_PDU
    );
    const proxyPDUSeg1 = pduBuilder.finalizeProxyPDU(
      finalizedNetworkPDUSeg1,
      MessageType.NETWORK_PDU
    );

    this.meshConfigurationManager.updateSeq();

    console.log(`sending config add AppKey seg0: ${proxyPDUSeg0}`);
    this.bluetoothManager.sendProxyPDU(proxyPDUSeg0);
    this.waitAndSendMessage(proxyPDUSeg1, 500, "sending config add AppKey seg1");
  }

  modelAppKeyBind(nodeAddress: string, elementAddress: string, modelId: string) {
    const devKey = this.meshConfigurationManager.getNodeDevKey(nodeAddress);
    if (!devKey) return;

    const seq = this.meshConfigurationManager.getSeq();

    const accessPayload = pduBuilder.makeAccessPayload(
      OpCode.MODEL_APP_BIND,
      utils.swapHexEndianness(elementAddress) +
        utils.swapHexEndianness("0000") +
        utils.swapHexEndianness(modelId)
    );

    const upperTransportPDUInputParams: MakeUpperTransportPDUParams = {
      seq: seq,
      src: "0001",
      dst: nodeAddress,
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      accessPayload,
      keyType: "device",
    };
    const upperTransportPDU = pduBuilder.makeUpperTransportPDU(upperTransportPDUInputParams);

    const lowerTransportPDUInputParams: MakeLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDU,
      isAppKey: false,
    };
    const lowerTransportPDU = pduBuilder.makeLowerTransportPDU(lowerTransportPDUInputParams);

    const securedNetworkPDUInputParams: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: nodeAddress,
      lowerTransportPDU: lowerTransportPDU,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      nonceType: "network",
    };
    const securedNetworkPDU = pduBuilder.makeSecureNetworkLayer(securedNetworkPDUInputParams);

    const obfuscateNetworkPDUInputParams: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDU,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
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

    const proxyPDU = pduBuilder.finalizeProxyPDU(finalizedNetworkPDU, MessageType.NETWORK_PDU);

    this.meshConfigurationManager.updateSeq();

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
    if (!devKey) return;

    const seq = this.meshConfigurationManager.getSeq();

    const accessPayload = pduBuilder.makeAccessPayload(
      OpCode.MODEL_PUBLICATION_SET,
      utils.swapHexEndianness(elementAddress) +
        utils.swapHexEndianness(publishAddress) +
        utils.swapHexEndianness("0000") +
        utils.swapHexEndianness("05") +
        utils.swapHexEndianness("00") +
        utils.swapHexEndianness("00") +
        utils.swapHexEndianness(modelId)
    );

    const upperTransportPDUInputParams: MakeUpperTransportPDUParams = {
      seq: seq,
      src: "0001",
      dst: nodeAddress,
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      accessPayload,
      keyType: "device",
    };
    const upperTransportPDU = pduBuilder.makeUpperTransportPDU(upperTransportPDUInputParams);

    const lowerTransportPDUInputParams: MakeLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDU,
      isAppKey: false,
    };
    const lowerTransportPDU = pduBuilder.makeLowerTransportPDU(lowerTransportPDUInputParams);

    const securedNetworkPDUInputParams: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: nodeAddress,
      lowerTransportPDU: lowerTransportPDU,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      nonceType: "network",
    };
    const securedNetworkPDU = pduBuilder.makeSecureNetworkLayer(securedNetworkPDUInputParams);

    const obfuscateNetworkPDUInputParams: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDU,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
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

    const proxyPDU = pduBuilder.finalizeProxyPDU(finalizedNetworkPDU, MessageType.NETWORK_PDU);

    this.meshConfigurationManager.updateSeq();

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
    if (!devKey) return;

    const seq = this.meshConfigurationManager.getSeq();

    const accessPayload = pduBuilder.makeAccessPayload(
      OpCode.MODEL_SUBSCRIPTION_ADD,
      utils.swapHexEndianness(elementAddress) +
        utils.swapHexEndianness(subscriptionAddress) +
        utils.swapHexEndianness(modelId)
    );

    const upperTransportPDUInputParams: MakeUpperTransportPDUParams = {
      seq: seq,
      src: "0001",
      dst: nodeAddress,
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      accessPayload,
      keyType: "device",
    };
    const upperTransportPDU = pduBuilder.makeUpperTransportPDU(upperTransportPDUInputParams);

    const lowerTransportPDUInputParams: MakeLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDU,
      isAppKey: false,
    };
    const lowerTransportPDU = pduBuilder.makeLowerTransportPDU(lowerTransportPDUInputParams);

    const securedNetworkPDUInputParams: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: nodeAddress,
      lowerTransportPDU: lowerTransportPDU,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      nonceType: "network",
    };
    const securedNetworkPDU = pduBuilder.makeSecureNetworkLayer(securedNetworkPDUInputParams);

    const obfuscateNetworkPDUInputParams: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDU,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
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

    const proxyPDU = pduBuilder.finalizeProxyPDU(finalizedNetworkPDU, MessageType.NETWORK_PDU);

    this.meshConfigurationManager.updateSeq();

    console.log(`sending config model subscription add: ${proxyPDU}`);
    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }

  getCompositionData(nodeAddress: string, page: string, devKey: string) {
    const accessPayload = pduBuilder.makeAccessPayload(
      OpCode.COMPOSITION_DATA_GET,
      utils.swapHexEndianness(page)
    );
    const seq = this.meshConfigurationManager.getSeq();

    const upperTransportPDUInputParams: MakeUpperTransportPDUParams = {
      seq: seq,
      src: "0001",
      dst: nodeAddress,
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      accessPayload,
      keyType: "device",
    };
    const upperTransportPDU = pduBuilder.makeUpperTransportPDU(upperTransportPDUInputParams);

    const lowerTransportPDUInputParams: MakeLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDU,
      isAppKey: false,
    };
    const lowerTransportPDU = pduBuilder.makeLowerTransportPDU(lowerTransportPDUInputParams);

    const securedNetworkPDUInputParams: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: nodeAddress,
      lowerTransportPDU: lowerTransportPDU,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      nonceType: "network",
    };
    const securedNetworkPDU = pduBuilder.makeSecureNetworkLayer(securedNetworkPDUInputParams);

    const obfuscateNetworkPDUInputParams: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDU,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
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

    const proxyPDU = pduBuilder.finalizeProxyPDU(finalizedNetworkPDU, MessageType.NETWORK_PDU);

    this.meshConfigurationManager.updateSeq();

    console.log(`sending config get composition data: ${proxyPDU}`);
    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }

  onConfigMessageReceived(pdu: ProxyPDU) {
    this.parseConfigMessage(pdu.data, pdu.src!);
  }

  private parseConfigMessage(pdu: AccessPayloadData, src: string) {
    switch (pdu.opcode as OpCode) {
      case OpCode.COMPOSITION_DATA_STATUS:
        const nodeComposition = this.parseCompositionData(pdu.params);
        this.meshConfigurationManager.addNodeComposition(src, nodeComposition);
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

  private waitAndSendMessage(message: string, waitTime: number, log: string) {
    setTimeout(() => {
      console.log(`${log}: ${message}`);
      this.bluetoothManager.sendProxyPDU(message);
    }, waitTime);
  }
}

export default ConfigClient;
