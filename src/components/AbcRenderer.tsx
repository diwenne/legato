"use client";

import React, { useEffect, useRef } from "react";
import abcjs from "abcjs";

interface AbcRendererProps {
  notation: string;
  onElementClick?: (position: { start: number; end: number }) => void;
}

export default function AbcRenderer({
  notation,
  onElementClick,
}: AbcRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && notation) {
      abcjs.renderAbc(containerRef.current, notation, {
        responsive: "resize",
        add_classes: true,
        clickListener: (
          abcElem: unknown,
          _tuneNumber: number,
          _classes: string,
          analysis: unknown
        ) => {
          const analysisObj = analysis as
            | { startChar?: number; endChar?: number }
            | undefined;
          if (
            onElementClick &&
            analysisObj &&
            typeof analysisObj.startChar === "number" &&
            typeof analysisObj.endChar === "number"
          ) {
            onElementClick({
              start: analysisObj.startChar,
              end: analysisObj.endChar,
            });
          }
        },
      });

      // Fix SVG colors after render - abcjs uses white fill by default
      const svg = containerRef.current.querySelector("svg");
      if (svg) {
        svg.querySelectorAll("path").forEach((path) => {
          path.setAttribute("fill", "#1a1a1a");
          path.setAttribute("stroke", "#1a1a1a");
        });
        svg.querySelectorAll("text").forEach((text) => {
          text.setAttribute("fill", "#1a1a1a");
        });
        svg.querySelectorAll("line").forEach((line) => {
          line.setAttribute("stroke", "#1a1a1a");
        });
      }
    }
  }, [notation, onElementClick]);

  return (
    <div
      ref={containerRef}
      className="abcjs-container w-full h-full overflow-auto bg-white p-4 rounded-lg"
    />
  );
}
