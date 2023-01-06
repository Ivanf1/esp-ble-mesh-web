import { SEQ_KEY, MESH_CONFIGURATION_KEY } from "../constants/storageKeys";
import { MeshNetworkConfiguration, ProvisionedNodeElement } from "./meshConfiguration.interface";
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
    // const data = await this.retrieveMeshConfiguration();
    // if (!data) {
    //   console.log(`could not retrieve mesh configuration`);
    //   return;
    // }
    if (this.getMeshConfiguration()) {
      this.meshConfiguration = this.getMeshConfiguration();
    } else {
      this.newMeshConfiguration();
      this.storeMeshConfiguration();
    }

    // this.meshConfiguration = data;

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

  public updateSeq() {
    this.seq++;
    this.updateSequenceNumberInLocalStorage();
  }

  public addNode(unicastAddress: string, devKey: string, elementsNum: number) {
    const elements = Array.from({ length: elementsNum }, (_, i) => {
      return {
        index: i,
        location: "",
        models: [],
      } as ProvisionedNodeElement;
    });

    this.meshConfiguration?.nodes.push({
      appKeys: [{ index: 0, updated: false }],
      cid: "0000",
      configComplete: false,
      crpl: "0000",
      deviceKey: devKey,
      elements: elements,
      excluded: false,
      features: { friend: 2, lowPower: 2, proxy: 2, relay: 2 },
      name: "",
      netKeys: [{ index: 0, updated: false }],
      security: "secure",
      unicastAddress: unicastAddress,
      UUID: crypto.generateUUID(),
      defaultTTL: 5,
    });

    this.storeMeshConfiguration();
  }

  public addNodeComposition(nodeUnicastAddress: string, nodeComposition: NodeComposition) {
    const idx = this.meshConfiguration?.nodes.findIndex(
      (n) => n.unicastAddress === nodeUnicastAddress
    );
    if (!idx || idx < 0) return;

    const elements = nodeComposition.elements.map((e, i) => {
      return {
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
      };
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
              ],
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
    const data = await response.json();
    return data.config as MeshNetworkConfiguration;
  }

  private getSequenceNumberFromLocalStorage = () => {
    const seq = localStorage.getItem(SEQ_KEY);
    return seq ? JSON.parse(seq) : 0;
  };

  private updateSequenceNumberInLocalStorage = () => {
    localStorage.setItem(SEQ_KEY, JSON.stringify(this.seq));
  };

  private storeMeshConfiguration = () => {
    localStorage.setItem(MESH_CONFIGURATION_KEY, JSON.stringify(this.meshConfiguration));
  };
  private getMeshConfiguration = () => {
    const mesh = localStorage.getItem(MESH_CONFIGURATION_KEY);
    return mesh ? JSON.parse(mesh) : null;
  };
}

export default MeshConfigurationManager;
