import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ForceGraph2D } from "react-force-graph";
import MeshConfigurationManager from "../../bluetooth/MeshConfigurationManager";
import GenericOnOffClient, {
  OnOffClientStatusUpdate,
} from "../../bluetooth/models/GenericOnOffClient";
import { meshToGraph } from "./graphMapping";

export interface Node {
  id: string;
  name: string;
  type: "node" | "group";
}
export interface Link {
  source: string;
  target: string;
  type: "pub" | "sub" | "pubsub";
}
interface GraphSize {
  width: number;
  height: number;
}
interface Props {
  MeshConfigurationManager: MeshConfigurationManager;
  GenericOnOffClient: GenericOnOffClient;
}
const Graph = ({ MeshConfigurationManager, GenericOnOffClient }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  /// @ts-ignore
  const fgRef = useRef<ForceGraphMethods | null>(null);
  const [graphSize, setGraphSize] = useState<GraphSize>({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const graphData2 = meshToGraph(MeshConfigurationManager);

  const handleClick = useCallback(
    (graphNode: unknown) => {
      const node = graphNode as Node;
      // if (!fgRef || !fgRef.current) return;
      // fgRef.current.zoom(5, 1000);

      setSelectedNode(node.id);
    },
    [fgRef]
  );

  useLayoutEffect(() => {
    if (containerRef && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setGraphSize(() => {
        return { width: rect.width, height: rect.height } as GraphSize;
      });
    }
  }, [containerRef]);

  useLayoutEffect(() => {
    if (fgRef && fgRef.current) {
      fgRef.current.d3Force("link").distance((_: any) => 50);
    }
  });

  return (
    <div className="w-full h-full mx-auto relative" ref={containerRef}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData2}
        maxZoom={8}
        minZoom={1}
        width={graphSize.width}
        height={graphSize.height}
        onNodeClick={handleClick}
        nodeCanvasObject={(node, ctx) => {
          if (!node || !node.x || !node.y) return;
          const label = (node as Node).name;
          const fontSize = 3;

          let textMarginTop: number = 0;
          ctx.font = `${fontSize}px Poppins`;
          if ((node as Node).type == "node") {
            ctx.fillStyle = "#00e16d";
            ctx.beginPath();
            ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
            ctx.fill();
            textMarginTop = 8 + 4;
          } else {
            ctx.fillStyle = "#00dad6";
            ctx.fillRect(node.x - 11, node.y - 5, 22, 10);
            textMarginTop = 8;
          }

          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "black";
          ctx.fillText(label, node.x, node.y + textMarginTop);
        }}
        linkCanvasObject={(link, ctx) => {
          const [srcX, srcY] = [(link.source as any).x, (link.source as any).y];
          const [targX, targY] = [(link.target as any).x, (link.target as any).y];

          // pub blue - sub red
          // ctx.strokeStyle = (link as Link).type == "pub" ? "#feabd6" : "#fdb570";
          const linkType = (link as Link).type;
          let strokeColor = "";
          if (linkType == "pub") {
            strokeColor = "#fda5fe";
          } else if (linkType == "sub") {
            strokeColor = "#fdb570";
          } else if (linkType == "pubsub") {
            strokeColor = "#bdbefe";
          }
          ctx.strokeStyle = strokeColor;
          ctx.beginPath();
          ctx.moveTo(targX, targY);
          ctx.lineTo(srcX, srcY);
          ctx.lineWidth = 0.6;
          ctx.lineCap = "round";
          ctx.stroke();
        }}
      />
      <div className="min-w-[300px] min-h-[100px] bg-white absolute top-10 right-10 border-border border-2 rounded-lg p-4">
        <label>Legend</label>
        <div className="grid grid-cols-[auto_1fr] gap-4 mt-5">
          <div className="w-[20px] h-[20px] bg-accent-teal flex self-center rounded-full ml-auto mr-auto" />
          <span className="">Node</span>
          <div className="w-[40px] h-[20px] bg-accent-cyan flex self-center" />
          <span className="">Group</span>
          <div className="w-[40px] h-[4px] bg-accent-fucsia flex self-center" />
          <span className="">Node publishes to Group</span>
          <div className="w-[40px] h-[4px] bg-accent-orange flex self-center" />
          <span className="">Node is subscribed to Group</span>
          <div className="w-[40px] h-[4px] bg-accent-indigo flex self-center" />
          <span className="">Node is subscribed and publishes to Group</span>
        </div>
      </div>
      {selectedNode && <Overlay />}
      {selectedNode && (
        <NodeDetails unicastAddress={selectedNode} genericOnOffClient={GenericOnOffClient} />
      )}
    </div>
  );
};

interface NodeDetailsProps {
  unicastAddress: string;
  genericOnOffClient: GenericOnOffClient;
}
type ledStatus = "on" | "off";
const NodeDetails = ({ unicastAddress, genericOnOffClient }: NodeDetailsProps) => {
  const [status, setStatus] = useState<ledStatus>("off");

  const onSetLed = (toSet: boolean) => {
    genericOnOffClient.sendSetMessage(toSet, "0003");
    // setStatus(toSet ? "on" : "off");
  };

  const onLedUpdate = (status: OnOffClientStatusUpdate) => {
    setStatus(status.status === 0 ? "off" : "on");
  };

  useState(() => {
    genericOnOffClient.registerStatusUpdateCallback("graph", onLedUpdate);

    return () => genericOnOffClient.removeStatusUpdateCallback("graph");
  });

  return (
    <div className="bg-white centered-axis-xy min-w-[800px] min-h-[500px] p-8 rounded-lg flex flex-col">
      <div className="flex flex-row items-center">
        <span>ESP-NODE-LIGHT</span>
      </div>

      <div className="flex flex-col gap-2 mt-10">
        <label>Primary Element</label>
        <div className="border-solid border-2 border-border rounded-lg flex flex-col p-4">
          <label>Generic OnOff Server</label>
          <div className="border-solid border-2 border-border rounded-lg p-4 mt-2">
            <div className="flex flex-row gap-4 items-center">
              <span>Status: {status} </span>
              <div className="ml-auto flex flex-row gap-4">
                <button className="secondary">Get Status</button>
                <button className="secondary" onClick={() => onSetLed(true)}>
                  Set On
                </button>
                <button className="secondary" onClick={() => onSetLed(false)}>
                  Set Off
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button className="secondary ml-auto mt-auto">Configure node</button>

      <div className=""></div>
    </div>
  );
};

const Overlay = () => {
  return <div className="overlay centered-axis-xy min-w-full min-h-full "></div>;
};

export default Graph;
