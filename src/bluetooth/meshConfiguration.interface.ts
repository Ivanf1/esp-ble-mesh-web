export interface MeshNetworkConfiguration {
  $schema: string;
  appKeys: AppKey[];
  groups: Group[];
  id: string;
  meshName: string;
  meshUUID: string;
  netKeys: NetKey[];
  networkExclusions: NetworkExclusion[];
  nodes: Node[];
  partial: boolean;
  provisioners: Provisioner[];
  scenes: any[];
  timestamp: string;
  version: string;
}

export interface AppKey {
  boundNetKey: number;
  index: number;
  key: string;
  name: string;
}

export interface Group {
  address: string;
  name: string;
  parentAddress: string;
}

export interface NetKey {
  index: number;
  key: string;
  minSecurity: string;
  name: string;
  phase: number;
  timestamp: string;
}

export interface NetworkExclusion {
  addresses: string[];
  ivIndex: number;
}

export interface Node {
  appKeys: Key[];
  cid: string;
  configComplete: boolean;
  crpl: string;
  defaultTTL?: number;
  deviceKey: string;
  elements: Element[];
  excluded: boolean;
  features: Features;
  name: string;
  netKeys: Key[];
  security: string;
  unicastAddress: string;
  UUID: string;
  pid?: string;
  vid?: string;
}

export interface Key {
  index: number;
  updated: boolean;
}

export interface Element {
  index: number;
  location: string;
  models: Model[];
  name?: string;
}

export interface Model {
  bind: number[];
  modelID: string;
  subscribe: string[];
  publish?: Publish;
}

export interface Publish {
  address: string;
  credentials: number;
  index: number;
  period: Period;
  retransmit: Retransmit;
  ttl: number;
}

export interface Period {
  numberOfSteps: number;
  resolution: number;
}

export interface Retransmit {
  count: number;
  interval: number;
}

export interface Features {
  friend: number;
  lowPower: number;
  proxy: number;
  relay: number;
}

export interface Provisioner {
  allocatedGroupRange: AllocatedRange[];
  allocatedSceneRange: AllocatedSceneRange[];
  allocatedUnicastRange: AllocatedRange[];
  provisionerName: string;
  UUID: string;
}

export interface AllocatedRange {
  highAddress: string;
  lowAddress: string;
}

export interface AllocatedSceneRange {
  firstScene: string;
  lastScene: string;
}
