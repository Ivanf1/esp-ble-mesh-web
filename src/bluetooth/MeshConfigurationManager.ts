import { SEQ_KEY, MESH_CONFIGURATION_KEY } from "../constants/storageKeys";
import {
  MeshNetworkConfiguration,
  ProvisionedNode,
  ProvisionedNodeElement,
} from "./meshConfiguration.interface";
import utils from "../utils/utils";
import crypto from "./crypto";

export interface NodeComposition {
  cid: string;
  pid: string;
  vid: string;
  crpl: string;
  relay: boolean;
  proxy: boolean;
  friend: boolean;
  lowPower: boolean;
  elements: ElementComposition[];
}
export interface ElementComposition {
  location: string;
  sigModels: string[];
  vendorModels: string[];
}

interface MeshConfigurationManagerProps {
  meshConfigurationServerUrl: string;
  meshConfigurationId: string;
}
class MeshConfigurationManager {
  private meshConfigurationServerUrl: string = "";
  private meshConfigurationId: string = "";
  private meshConfiguration: MeshNetworkConfiguration | null = null;

  private seq: number = 0;
  private ivIndex: string = "";
  private ivi: number = 0;
  private netKey: string = "";
  private appKey: string = "";
  private encryptionKey: string = "";
  private privacyKey: string = "";
  private NID: string = "";
  private networkId: string = "";
  private AID: string = "";

  constructor(configuration: MeshConfigurationManagerProps) {
    this.meshConfigurationServerUrl = configuration.meshConfigurationServerUrl;
    this.meshConfigurationId = configuration.meshConfigurationId;
  }

  public async initialize() {
    const data = await this.retrieveMeshConfiguration();
    if (!data) {
      console.log(`could not retrieve mesh configuration`);

      if (this.getMeshConfigurationFromLocalStorage()) {
        this.meshConfiguration = this.getMeshConfigurationFromLocalStorage();
      } else {
        this.newMeshConfiguration();
        this.updateMeshConfiguration();
      }
    } else {
      this.meshConfiguration = data;
      this.storeMeshConfigurationInLocalStorage();
    }

    this.netKey = this.meshConfiguration!.netKeys[0].key;
    this.appKey = this.meshConfiguration!.appKeys[0].key;
    this.ivIndex = this.meshConfiguration!.ivIndex;
    this.ivi = utils.leastSignificantBit(parseInt(this.ivIndex, 16));

    const k2Material = crypto.k2(this.netKey, "00");
    this.encryptionKey = k2Material.encryptionKey;
    this.privacyKey = k2Material.privacyKey;
    this.NID = k2Material.NID;

    this.networkId = crypto.k3(this.netKey);
    this.AID = crypto.k4(this.appKey);

    this.seq = this.getSequenceNumberFromLocalStorage();
  }

  public getNetKeyIndex() {
    return utils.toHex(this.meshConfiguration!.netKeys[0].index, 2);
  }
  public getAppKeyIndex() {
    return utils.toHex(this.meshConfiguration!.appKeys[0].index, 2);
  }
  public getAppKeyByIndex(idx: number) {
    return this.meshConfiguration!.appKeys[idx].key;
  }
  public getIvIndex() {
    return this.ivIndex;
  }
  public getIvi() {
    return this.ivi;
  }
  public getNetKey() {
    return this.netKey;
  }
  public getAppKey() {
    return this.appKey;
  }
  public getEncryptionKey() {
    return this.encryptionKey;
  }
  public getPrivacyKey() {
    return this.privacyKey;
  }
  public getNID() {
    return this.NID;
  }
  public getNetworkId() {
    return this.networkId;
  }
  public getAID() {
    return this.AID;
  }
  public getSeq() {
    return this.seq;
  }
  public getNodes() {
    return this.meshConfiguration?.nodes;
  }
  public getNodeById(id: string) {
    return this.meshConfiguration?.nodes.find((n) => n.id === id);
  }
  public getNodeByUnicastAddress(nodeUnicastAddress: string) {
    return this.meshConfiguration?.nodes.find((n) => n.unicastAddress === nodeUnicastAddress);
  }
  public getNodeDevKey(nodeUnicastAddress: string) {
    return this.getNodeByUnicastAddress(nodeUnicastAddress)?.deviceKey;
  }
  public getDefaultTTLForNode(nodeUnicastAddress: string) {
    return utils.toHex(this.getNodeByUnicastAddress(nodeUnicastAddress)!.defaultTTL!, 1);
  }
  public getNextUnicastAddressAvailable() {
    const lastNode = this.meshConfiguration!.nodes.at(this.meshConfiguration!.nodes.length - 1);
    if (!lastNode) return;

    const nextAvailable = parseInt(lastNode.unicastAddress, 16) + lastNode.elements.length;

    return utils.toHex(nextAvailable, 2);
  }
  public getProvisionerUnicastAddress() {
    return this.meshConfiguration!.nodes[0].unicastAddress;
  }
  public getGroups() {
    return this.meshConfiguration!.groups;
  }
  public getSubscribersForGroup(groupAddress: string) {
    let subscribers: ProvisionedNode[] = [];

    for (const node of this.meshConfiguration!.nodes) {
      for (const element of node.elements) {
        for (const model of element.models) {
          if (
            model.subscribe.findIndex((a) => a.toLowerCase() === groupAddress.toLowerCase()) >= 0
          ) {
            subscribers.push(node);
          }
        }
      }
    }

    return subscribers;
  }
  public getPublishersForGroup(groupAddress: string) {
    let publishers: ProvisionedNode[] = [];

    for (const node of this.meshConfiguration!.nodes) {
      for (const element of node.elements) {
        for (const model of element.models) {
          if (model.publish && model.publish.address.toLowerCase() === groupAddress.toLowerCase()) {
            publishers.push(node);
          }
        }
      }
    }

    return publishers;
  }

  public updateSeq() {
    this.seq++;
    this.updateSequenceNumberInLocalStorage();
  }
  public updateElementName(nodeId: string, elementIndex: number, elementName: string) {
    const node = this.getNodeById(nodeId);
    if (!node) return;
    const element = node.elements[elementIndex];
    if (!element) return;
    element.name = elementName;
    this.updateMeshConfiguration();
  }
  public updateGroupName(address: string, newName: string) {
    const group = this.meshConfiguration?.groups.find((g) => g.address === address);
    if (!group) return;
    group.name = newName;
    this.updateMeshConfiguration();
  }

  public addNode(
    unicastAddress: string,
    devKey: string,
    elementsNum: number,
    id: string,
    name: string
  ) {
    const elements = Array.from({ length: elementsNum }, (_, i) => {
      const address = utils.toHex(parseInt(unicastAddress, 16) + i, 2);
      return {
        index: i,
        location: "",
        models: [],
        name: `Element ${i}`,
        address: address,
      } as ProvisionedNodeElement;
    });

    this.meshConfiguration?.nodes.push({
      appKeys: [],
      cid: "0000",
      configComplete: false,
      crpl: "0000",
      deviceKey: devKey,
      elements: elements,
      excluded: false,
      features: { friend: 2, lowPower: 2, proxy: 2, relay: 2 },
      name: name,
      netKeys: [{ index: 0, updated: false }],
      security: "secure",
      unicastAddress: unicastAddress,
      UUID: crypto.generateUUID(),
      defaultTTL: 5,
      id: id,
    });

    this.updateMeshConfiguration();
  }
  public addNodeComposition(nodeUnicastAddress: string, nodeComposition: NodeComposition) {
    const idx = this.meshConfiguration?.nodes.findIndex(
      (n) => n.unicastAddress === nodeUnicastAddress
    );
    if (!idx || idx < 0) return;
    const node = this.meshConfiguration!.nodes[idx];

    const elements = nodeComposition.elements.map((e, i) => {
      const element = node.elements[i];

      return {
        ...element,
        index: i,
        location: e.location,
        models: [
          ...e.sigModels.map((modelId) => {
            return {
              bind: [],
              modelID: modelId,
              subscribe: [],
            };
          }),
          ...e.vendorModels.map((modelId) => {
            return {
              bind: [],
              modelID: modelId,
              subscribe: [],
            };
          }),
        ],
      } as ProvisionedNodeElement;
    });

    this.meshConfiguration!.nodes[idx] = {
      ...this.meshConfiguration!.nodes[idx],
      cid: nodeComposition.cid,
      pid: nodeComposition.pid,
      vid: nodeComposition.vid,
      crpl: nodeComposition.crpl,
      features: {
        relay: nodeComposition.relay ? 1 : 2,
        proxy: nodeComposition.proxy ? 1 : 2,
        friend: nodeComposition.friend ? 1 : 2,
        lowPower: nodeComposition.lowPower ? 1 : 2,
      },
      elements: elements,
    };

    this.updateMeshConfiguration();
  }
  public addAppKeyNodeById(nodeId: string, appKey: string) {
    const k = this.meshConfiguration?.appKeys.find((k) => k.key === appKey);
    const node = this.getNodeById(nodeId);
    if (!k || !node) return;
    // Check if already bounded
    if (node.appKeys.findIndex((a) => a.index === k.index) > -1) return;

    node.appKeys.push({ index: k.index, updated: false });
    this.updateMeshConfiguration();
  }
  public addAppKeyNodeByAddress(nodeAddress: string, appKey: string) {
    const k = this.meshConfiguration?.appKeys.find((k) => k.key === appKey);
    const node = this.getNodeByUnicastAddress(nodeAddress);
    if (!k || !node) return;
    // Check if already bounded
    if (node.appKeys.findIndex((a) => a.index === k.index) > -1) return;

    node.appKeys.push({ index: k.index, updated: false });
    this.updateMeshConfiguration();
  }
  public addAppKeyModelNodeByAddress(
    nodeAddress: string,
    elementAddress: string,
    modelId: string,
    appKey: string
  ) {
    const k = this.meshConfiguration?.appKeys.find((k) => k.key === appKey);
    const node = this.getNodeByUnicastAddress(nodeAddress);
    if (!k || !node) return;
    const element = node.elements.find((e) => e.address === elementAddress);
    if (!element) return;
    const model = element.models.find((m) => m.modelID === modelId);
    if (!model) return;
    if (model.bind.findIndex((a) => a === k.index) > -1) return;

    model.bind.push(k.index);
    this.updateMeshConfiguration();
  }
  public setNodeModelPub(
    nodeAddress: string,
    elementAddress: string,
    modelId: string,
    pubAddress: string
  ) {
    const node = this.getNodeByUnicastAddress(nodeAddress);
    if (!node) return;
    const element = node.elements.find((e) => e.address === elementAddress);
    if (!element) return;
    const model = element.models.find((m) => m.modelID === modelId);
    if (!model) return;

    model.publish = {
      address: pubAddress,
      credentials: 0,
      index: 0,
      period: { numberOfSteps: 0, resolution: 100 },
      retransmit: { count: 0, interval: 50 },
      ttl: 255,
    };
    this.updateMeshConfiguration();
  }
  public addNodeModelSub(
    nodeAddress: string,
    elementAddress: string,
    modelId: string,
    subAddress: string
  ) {
    const node = this.getNodeByUnicastAddress(nodeAddress);
    if (!node) return;
    const element = node.elements.find((e) => e.address === elementAddress);
    if (!element) return;
    const model = element.models.find((m) => m.modelID === modelId);
    if (!model) return;
    if (model.subscribe.findIndex((sub) => sub.toLowerCase() === subAddress.toLowerCase()) > -1)
      return;

    model.subscribe.push(subAddress.toUpperCase());
    this.updateMeshConfiguration();
  }
  public addGroup(address: string, name: string) {
    this.meshConfiguration?.groups.push({
      address: address,
      name: name,
      parentAddress: "0000",
    });
    this.updateMeshConfiguration();
  }

  public isAppKeyBoundedToNode(nodeAddress: string, appKey: string) {
    const k = this.meshConfiguration?.appKeys.find((k) => k.key === appKey);
    const node = this.getNodeByUnicastAddress(nodeAddress);
    if (!k || !node) return false;

    return node.appKeys.findIndex((a) => a.index === k.index) > -1;
  }

  public deleteGroup(address: string) {
    const filteredGroups = this.meshConfiguration?.groups.filter(
      (g) => g.address.toLowerCase() !== address.toLowerCase()
    );
    if (!filteredGroups) return;
    this.meshConfiguration!.groups = filteredGroups;
    this.updateMeshConfiguration();
  }

  private newMeshConfiguration() {
    const timestamp = new Date().toISOString();
    const thisNodeUUID = crypto.generateUUID();

    const configuration: MeshNetworkConfiguration = {
      $schema: "http://json-schema.org/draft-04/schema#",
      appKeys: [
        {
          boundNetKey: 0,
          index: 0,
          // key: crypto.generateMeshKey(),
          key: "45f2c17c294b0e2d3481c08eff9dc64b",
          name: "App Key 1",
        },
      ],
      groups: [],
      id: "http://www.bluetooth.com/specifications/assigned-numbers/mesh-profile/cdb-schema.json#",
      meshName: "New Mesh",
      meshUUID: crypto.generateUUID(),
      netKeys: [
        {
          index: 0,
          // key: crypto.generateMeshKey(),
          key: "0aec1a4fcff878cfaf8cef747b0e8d00",
          minSecurity: "secure",
          name: "Primary Network Key",
          phase: 0,
          timestamp: timestamp,
        },
      ],
      networkExclusions: [],
      nodes: [
        {
          appKeys: [{ index: 0, updated: false }],
          cid: "0000",
          configComplete: true,
          crpl: "0000",
          deviceKey: crypto.generateMeshKey(),
          elements: [
            {
              index: 0,
              location: "0001",
              models: [
                {
                  bind: [0],
                  modelID: "1001", // Generic OnOff Client
                  subscribe: [],
                },
                {
                  bind: [0],
                  modelID: "1102", // Sensor Client
                  subscribe: [],
                },
                {
                  bind: [0],
                  modelID: "000002e5", // WiFi Config Client
                  subscribe: [],
                },
                {
                  bind: [0],
                  modelID: "000202e5", // MQTT Config Client
                  subscribe: [],
                },
              ],
              name: "Primary Element",
              address: "0001",
            },
          ],
          excluded: false,
          features: { friend: 2, lowPower: 2, proxy: 2, relay: 2 },
          name: "Web App",
          netKeys: [{ index: 0, updated: false }],
          security: "secure",
          unicastAddress: "0001",
          UUID: thisNodeUUID,
          defaultTTL: 5,
          id: "",
        },
      ],
      partial: false,
      provisioners: [
        {
          allocatedGroupRange: [{ highAddress: "CC9A", lowAddress: "C000" }],
          allocatedSceneRange: [{ firstScene: "0001", lastScene: "3333" }],
          allocatedUnicastRange: [{ highAddress: "199A", lowAddress: "0001" }],
          provisionerName: "Web App",
          UUID: thisNodeUUID,
        },
      ],
      scenes: [],
      timestamp: timestamp,
      version: "1.0.0",
      ivIndex: "00000000",
    };

    this.meshConfiguration = configuration;
  }

  private async retrieveMeshConfiguration() {
    const response = await fetch(
      `${this.meshConfigurationServerUrl}?id=${this.meshConfigurationId}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.config as MeshNetworkConfiguration;
  }
  private async postMeshConfiguration() {
    const b = {
      id: parseInt(this.meshConfigurationId),
      config: this.meshConfiguration,
    };
    fetch(`${this.meshConfigurationServerUrl}`, {
      method: "POST",
      body: JSON.stringify(b),
    });
  }

  private getSequenceNumberFromLocalStorage = () => {
    const seq = localStorage.getItem(SEQ_KEY);
    return seq ? JSON.parse(seq) : 0;
  };

  private updateSequenceNumberInLocalStorage = () => {
    localStorage.setItem(SEQ_KEY, JSON.stringify(this.seq));
  };

  private storeMeshConfigurationInLocalStorage = () => {
    localStorage.setItem(MESH_CONFIGURATION_KEY, JSON.stringify(this.meshConfiguration));
  };
  private getMeshConfigurationFromLocalStorage = () => {
    const mesh = localStorage.getItem(MESH_CONFIGURATION_KEY);
    return mesh ? JSON.parse(mesh) : null;
  };
  private updateMeshConfiguration = () => {
    this.storeMeshConfigurationInLocalStorage();
    this.postMeshConfiguration();
  };
}

export default MeshConfigurationManager;
