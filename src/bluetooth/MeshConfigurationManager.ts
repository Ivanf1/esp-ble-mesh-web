import { LOCAL_STORAGE_SEQ_KEY } from "../constants/storageKeys";
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

  async initialize() {
    // const data = await this.retrieveMeshConfiguration();
    // if (!data) {
    //   console.log(`could not retrieve mesh configuration`);
    //   return;
    // }
    this.newMeshConfiguration();

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

  private async retrieveMeshConfiguration() {
    const response = await fetch(
      `${this.meshConfigurationServerUrl}?id=${this.meshConfigurationId}`
    );
    const data = await response.json();
    return data.config as MeshNetworkConfiguration;
  }

  private getSequenceNumberFromLocalStorage = () => {
    const seq = localStorage.getItem(LOCAL_STORAGE_SEQ_KEY);
    return seq ? JSON.parse(seq) : 0;
  };

  private updateSequenceNumberInLocalStorage = () => {
    localStorage.setItem(LOCAL_STORAGE_SEQ_KEY, JSON.stringify(this.seq));
  };

  getIvIndex() {
    return this.ivIndex;
  }
  getIvi() {
    return this.ivi;
  }
  getNetKey() {
    return this.netKey;
  }
  getAppKey() {
    return this.appKey;
  }
  getEncryptionKey() {
    return this.encryptionKey;
  }
  getPrivacyKey() {
    return this.privacyKey;
  }
  getNID() {
    return this.NID;
  }
  getNetworkId() {
    return this.networkId;
  }
  getAID() {
    return this.AID;
  }
  getSeq() {
    return this.seq;
  }
  getNodeByUnicastAddress(nodeUnicastAddress: string) {
    return this.meshConfiguration?.nodes.find((n) => n.unicastAddress === nodeUnicastAddress);
  }
  getNodeDevKey(nodeUnicastAddress: string) {
    return this.getNodeByUnicastAddress(nodeUnicastAddress)?.deviceKey;
  }

  updateSeq() {
    this.seq++;
    this.updateSequenceNumberInLocalStorage();
  }

  addNode(unicastAddress: string, devKey: string, elementsNum: number) {
    const elements = new Array(elementsNum).map((_, i) => {
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
    });
  }

  addNodeComposition(nodeUnicastAddress: string, nodeComposition: NodeComposition) {
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
          key: crypto.generateMeshKey(),
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
          key: crypto.generateMeshKey(),
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
}

export default MeshConfigurationManager;
