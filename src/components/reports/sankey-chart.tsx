"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from "d3-sankey";

interface SankeyNodeData {
  id: string;
  category: string;
}

interface SankeyLinkData {
  source: string;
  target: string;
  value: number;
}

interface SankeyData {
  nodes: Array<SankeyNodeData>;
  links: Array<SankeyLinkData>;
}

interface SankeyChartProps {
  data: SankeyData;
  width?: number;
  height?: number;
}

export function SankeyChart({ data, width = 800, height = 400 }: SankeyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    type SankeyNodeType = SankeyNode<SankeyNodeData, SankeyLinkData>;
    type SankeyLinkType = SankeyLink<SankeyNodeData, SankeyLinkData>;

    const sankeyGenerator = sankey<SankeyNodeType, SankeyLinkType>()
      .nodeId((d) => (d as SankeyNodeData).id)
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    const { nodes, links } = sankeyGenerator({
      nodes: data.nodes.map(d => ({ ...d })) as SankeyNodeType[],
      links: data.links.map(d => ({ ...d })) as SankeyLinkType[]
    });

    const colorScale = d3.scaleOrdinal<string>()
      .domain(['Income', 'Expense', 'Transfer'])
      .range(['#22c55e', '#ef4444', '#3b82f6']);

    g.append("g")
      .selectAll("rect")
      .data(nodes)
      .join("rect")
        .attr("x", (d: any) => d.x0)
        .attr("y", (d: any) => d.y0)
        .attr("height", (d: any) => d.y1 - d.y0)
        .attr("width", sankeyGenerator.nodeWidth())
        .attr("fill", (d: any) => colorScale(d.category))
        .attr("stroke", "#000")
        .attr("stroke-width", 0.5)
        .append("title")
        .text((d: any) => `${d.id}\n${d3.format(",.0f")(d.value)}`);

    const link = g.append("g")
      .attr("fill", "none")
      .selectAll("g")
      .data(links)
      .join("g")
        .style("mix-blend-mode", "multiply");

    link.append("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", (d: any) => colorScale(d.source.category))
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d: any) => Math.max(1, d.width))
      .append("title")
      .text((d: any) => `${d.source.id} → ${d.target.id}\n${d3.format(",.0f")(d.value)}`);

    g.append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
        .attr("x", (d: any) => d.x0 < innerWidth / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr("y", (d: any) => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", (d: any) => d.x0 < innerWidth / 2 ? "start" : "end")
        .attr("font-size", "12px")
        .attr("fill", "#374151")
        .text((d: any) => d.id);

  }, [data, width, height]);

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-visible"
      />
    </div>
  );
}