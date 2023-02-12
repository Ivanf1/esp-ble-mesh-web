import MeshConfigurationManager from "../../bluetooth/MeshConfigurationManager";
import { Link, Node } from "./Graph";

export const meshToGraph = (meshConfigurationManager: MeshConfigurationManager) => {
  const nodes = meshConfigurationManager.getNodes();
  const groups = meshConfigurationManager.getGroups();
  let graphNodes: Node[] = [];

  if (nodes) {
    nodes.forEach((n) => {
      graphNodes.push({ id: n.unicastAddress, name: n.name, type: "node" } as Node);
    });
  }
  groups.forEach((g) => {
    graphNodes.push({ id: g.address, name: g.name, type: "group" } as Node);
  });

  let links: Link[] = [];

  groups.forEach((g) => {
    const pubs = meshConfigurationManager.getPublishersForGroup(g.address);
    pubs.forEach((pub) => {
      links.push({ source: pub.unicastAddress, target: g.address, type: "pub" } as Link);
    });
    const subs = meshConfigurationManager.getSubscribersForGroup(g.address);
    subs.forEach((sub) => {
      links.push({ source: sub.unicastAddress, target: g.address, type: "sub" } as Link);
    });
  });

  return {
    nodes: graphNodes,
    links: links,
  };
};
