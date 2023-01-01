import { LOCAL_STORAGE_SEQ_KEY } from "../constants/storageKeys";
import { MeshNetworkConfiguration } from "./meshConfiguration.interface";
import utils from "../utils/utils";
import crypto from "./crypto";

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
    const data = await this.retrieveMeshConfiguration();
    if (!data) {
      console.log(`could not retrieve mesh configuration`);
      return;
    }

    this.meshConfiguration = data;

    this.netKey = this.meshConfiguration.netKeys[0].key;
    this.appKey = this.meshConfiguration.appKeys[0].key;
    this.ivIndex = utils.toHex(this.meshConfiguration.networkExclusions[0].ivIndex, 4);
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

  updateSeq() {
    this.seq++;
    this.updateSequenceNumberInLocalStorage();
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
          appKeys: [
            {
              index: 0,
              updated: false,
            },
          ],
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
          features: {
            friend: 2,
            lowPower: 2,
            proxy: 2,
            relay: 2,
          },
          name: "Web App",
          netKeys: [
            {
              index: 0,
              updated: false,
            },
          ],
          security: "secure",
          unicastAddress: "0001",
          UUID: thisNodeUUID,
        },
      ],
      partial: false,
      provisioners: [
        {
          allocatedGroupRange: [
            {
              highAddress: "CC9A",
              lowAddress: "C000",
            },
          ],
          allocatedSceneRange: [
            {
              firstScene: "0001",
              lastScene: "3333",
            },
          ],
          allocatedUnicastRange: [
            {
              highAddress: "199A",
              lowAddress: "0001",
            },
          ],
          provisionerName: "Web App",
          UUID: thisNodeUUID,
        },
      ],
      scenes: [],
      timestamp: timestamp,
      version: "1.0.0",
    };

    this.meshConfiguration = configuration;
  }
}

export default MeshConfigurationManager;
