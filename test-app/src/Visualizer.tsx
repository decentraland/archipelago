import React, { useEffect, useRef } from "react"
import { Archipelago } from "../../src"

import * as d3 from "d3"

export const useD3 = (
  renderChartFn: (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>) => void,
  dependencies: any[]
) => {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (ref.current) {
      renderChartFn(d3.select(ref.current!))
    }
    return () => {}
  }, dependencies)

  return ref
}

function makeTransparent(color: string, opacity: number = 0.05): string {
  const rgb = d3.rgb(color)
  rgb.opacity = opacity

  return rgb.toString()
}

export function Visualizer({ renderState }: { renderState: Archipelago | null }) {
  const refD3 = useD3(
    (svg) => {
      let islandsData: Array<{ x: number; y: number; island: string }> = []
      let data: Array<{
        peerId: string
        x: number
        y: number
        joinRadius: number
        leaveRadius: number
        island: string
      }> = []

      renderState?.getIslands().forEach((island) => {
        island.peers.forEach((peer) => {
          data.push({
            island: island.id,
            joinRadius: Math.sqrt(renderState.getOptions().joinDistance) / 2,
            leaveRadius: Math.sqrt(renderState.getOptions().leaveDistance) / 2,
            peerId: peer.id,
            x: peer.position[0],
            y: peer.position[2],
          })
        })

        // const centerX = island.peers.slice(1).reduce((a, b) => b.position[0] + a, island.peers[0].position[0])
        // const centerY = island.peers.slice(1).reduce((a, b) => b.position[0] + a, island.peers[0].position[0])

        // islandsData.push({
        //   x: centerX / island.peers.length,
        //   y: centerY / island.peers.length,
        //   island: island.id,
        // })
      })

      // set the dimensions and margins of the graph
      const height = svg.node()!.clientHeight
      const width = svg.node()!.clientWidth
      const margin = { top: 30, right: 30, bottom: 30, left: 30 }

      const minXValue = Math.min(...data.map((d) => d.x - 10))
      const minYValue = Math.min(...data.map((d) => d.y - 10))

      const maxXValue = Math.max(...data.map((d) => d.x + 10))
      const maxYValue = Math.max(...data.map((d) => d.y + 10))

      const maxDiff = Math.max(maxXValue - minXValue, maxYValue - minYValue)

      const x = d3
        .scaleLinear()
        .domain([minXValue, minXValue + maxDiff])
        .rangeRound([margin.left, width - margin.right])

      // Add Y axis
      const y = d3
        .scaleLinear()
        .domain([minYValue, minYValue + maxDiff])
        .rangeRound([height - margin.bottom, margin.top])

      const maxRadiusValue = Math.abs(x.domain()[1] - x.domain()[0])
      const maxScaled = Math.abs(x.range()[1] - x.range()[0])

      console.log("MAX SCALED " + maxScaled)

      const radiusScale = d3.scaleLinear().domain([0, maxRadiusValue]).range([0, maxScaled])

      svg
        .select<SVGGElement>(".x-axis")
        .call((g) =>
          g
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(20).tickSizeOuter(0))
        )

      svg.select<SVGGElement>(".y-axis").call((g) =>
        g
          .attr("transform", `translate(${margin.left},0)`)
          .style("color", "steelblue")
          .call(d3.axisLeft(y).ticks(20).tickSizeOuter(0))
          .call((g) => g.select(".domain").remove())
          .call((g) =>
            g
              .append("text")
              .attr("x", -margin.left)
              .attr("y", 10)
              .attr("fill", "currentColor")
              .attr("text-anchor", "start")
              .text("y")
          )
      )

      // Color scale: give me a specie name, I return a color
      var color = d3
        .scaleOrdinal()
        .domain(renderState?.getIslands().map((it) => it.id) ?? [])
        .range(d3.schemeCategory10)
      const ANIM_DURATION = 300

      // Highlight the specie that is hovered
      var highlight = function (evt: any) {
        const d: { peerId: string; x: number; y: number; island: string } = evt.target.__data__
        d3.selectAll(".dot").transition().duration(ANIM_DURATION).style("fill", "lightgrey").attr("r", 3)
        console.log(d)
        d3.selectAll("." + d.island)
          .transition()
          .duration(ANIM_DURATION)
          .style("fill", color(d.island) as string)
          .attr("r", 7)
      }

      // Highlight the specie that is hovered
      var doNotHighlight = function () {
        d3.selectAll(".dot").transition().duration(ANIM_DURATION).style("fill", "lightgrey").attr("r", 5)
      }

      // Add dots
      const svgPoints = svg
        .select(".plot-area")
        .selectAll(".dot")
        .data(data, function (d: any) {
          return d.peerId
        })

      // const svgIslands = svg
      //   .select(".plot-area")
      //   .selectAll(".island")
      //   .data(islandsData, function (d: any) {
      //     return d.island
      //   })

      const svgPointLabels = svg
        .select(".plot-area")
        .selectAll("text")
        .data(data, function (d: any) {
          return d.peerId
        })

      // svgIslands
      //   .enter()
      //   .append("rect")
      //   .attr("class", (d) => "island")
      //   .attr("x", (d) => x(d.x) - 2)
      //   .attr("y", (d) => y(d.y) - 2)
      //   .attr("width", (d) => 5)
      //   .attr("height", (d) => 5)

      //   .on("mouseover", highlight)
      //   .on("mouseleave", doNotHighlight)

      // svgIslands.exit().remove()

      // svgIslands
      //   .transition()
      //   .duration(ANIM_DURATION)
      //   .attr("class", (d) => "dot " + d.island)
      //   .attr("x", (d) => x(d.x) - 2)
      //   .attr("y", (d) => y(d.y) - 2)

      svgPoints
        .enter()
        .append("circle")
        .attr("class", (d) => "dot " + d.island)
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", 5)
        .on("mouseover", highlight)
        .on("mouseleave", doNotHighlight)

      svgPoints.exit().remove()

      svgPoints
        .transition()
        .duration(ANIM_DURATION)
        .attr("class", (d) => "dot " + d.island)
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", 5)

      svgPointLabels
        .enter()
        .append("text")
        .attr("x", (d) => x(d.x) - 10)
        .attr("y", (d) => y(d.y) - 10)
        .text(function (d) {
          return d.island + ": " + d.peerId
        })
        .attr("font-size", "10px")

      svgPointLabels.exit().remove()

      svgPointLabels
        .transition()
        .duration(ANIM_DURATION)
        .attr("x", (d) => x(d.x) - 10)
        .attr("y", (d) => y(d.y) - 10)
        .text(function (d) {
          return d.island + ": " + d.peerId
        })

      const d3dataleaveradius = svg
        .select(".plot-area")
        .selectAll(".leaveRadius")
        .data(data, function (d: any) {
          return d.peerId
        })

      d3dataleaveradius
        .enter()
        .append("circle")
        .attr("class", (d) => "leaveRadius")
        .style("fill", (d) => makeTransparent(color(d.island) as string))
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", (d) => radiusScale(d.leaveRadius))
        .lower()

      d3dataleaveradius
        .transition()
        .duration(ANIM_DURATION)
        .style("fill", (d) => makeTransparent(color(d.island) as string))
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", (d) => radiusScale(d.leaveRadius))

      d3dataleaveradius.exit().remove()

      const d3dataradius = svg
        .select(".plot-area")
        .selectAll(".connectRadius")
        .data(data, function (d: any) {
          return d.peerId
        })

      d3dataradius
        .enter()
        .append("circle")
        .attr("class", (d) => "connectRadius")
        .style("fill", (d) => makeTransparent(color(d.island) as string))
        .style("stroke", (d) => makeTransparent(color(d.island) as string, 0.5))
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", (d) => radiusScale(d.joinRadius))
        .lower()

      d3dataradius
        .transition()
        .duration(ANIM_DURATION)
        .style("fill", (d) => makeTransparent(color(d.island) as string))
        .style("stroke", (d) => makeTransparent(color(d.island) as string, 0.5))
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", (d) => radiusScale(d.joinRadius))

      d3dataradius.exit().remove()
    },
    [renderState]
  )

  return (
    <svg
      ref={refD3}
      style={{
        width: "75%",
        aspectRatio: "1/1",
        marginLeft: "12.5%",
      }}
    >
      <g className="plot-area" />
      <g className="x-axis" />
      <g className="y-axis" />
    </svg>
  )
}
