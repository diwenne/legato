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
          const analysisObj = analysis as { startChar?: number; endChar?: number } | undefined;
          if (onElementClick && analysisObj && typeof analysisObj.startChar === 'number' && typeof analysisObj.endChar === 'number') {
            onElementClick({
              start: analysisObj.startChar,
              end: analysisObj.endChar,
            });
          }
        },
      });
    }
  }, [notation, onElementClick]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto bg-white p-4 rounded-lg"
    />
  );
}
