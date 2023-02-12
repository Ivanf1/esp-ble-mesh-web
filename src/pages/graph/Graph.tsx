import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ForceGraph2D } from "react-force-graph";
import MeshConfigurationManager from "../../bluetooth/MeshConfigurationManager";
import { meshToGraph } from "./graphMapping";

export interface Node {
  id: string;
  name: string;
  type: "node" | "group";
}
export interface Link {
  source: string;
  target: string;
  type: "pub" | "sub";
}
interface GraphSize {
  width: number;
  height: number;
}
interface Props {
  MeshConfigurationManager: MeshConfigurationManager;
}
const Graph = ({ MeshConfigurationManager }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  /// @ts-ignore
  const fgRef = useRef<ForceGraphMethods | null>(null);
  const [graphSize, setGraphSize] = useState<GraphSize>({ width: 0, height: 0 });

  const graphData2 = meshToGraph(MeshConfigurationManager);

  const handleClick = useCallback(() => {
    if (!fgRef || !fgRef.current) return;
    fgRef.current.zoom(5, 1000);
  }, [fgRef]);

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
    <div className="w-full h-full mx-auto" ref={containerRef}>
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
            ctx.fillStyle = "#00f663";
            ctx.beginPath();
            ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
            ctx.fill();
            textMarginTop = 8 + 4;
          } else {
            ctx.fillStyle = "#e42a48";
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
          ctx.strokeStyle = (link as Link).type == "pub" ? "#25b6c3" : "#d04b69";
          ctx.beginPath();
          ctx.moveTo(targX, targY);
          ctx.lineTo(srcX, srcY);
          ctx.lineWidth = 0.6;
          ctx.lineCap = "round";
          ctx.stroke();
        }}
      />
    </div>
  );
};

export default Graph;
