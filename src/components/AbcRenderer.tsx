"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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
  const audioControlRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const synthRef = useRef<abcjs.synth.CreateSynth | null>(null);
  const visualObjRef = useRef<abcjs.TuneObject[] | null>(null);

  // Initialize and render
  useEffect(() => {
    if (containerRef.current && notation) {
      const visualObj = abcjs.renderAbc(containerRef.current, notation, {
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

      visualObjRef.current = visualObj;

      // Fix SVG colors after render
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

    // Cleanup: stop playback when notation changes
    return () => {
      if (synthRef.current) {
        synthRef.current.stop();
        setIsPlaying(false);
      }
    };
  }, [notation, onElementClick]);

  const handlePlayStop = useCallback(async () => {
    if (isPlaying && synthRef.current) {
      synthRef.current.stop();
      setIsPlaying(false);
      return;
    }

    if (!visualObjRef.current || visualObjRef.current.length === 0) return;

    try {
      // Create synth
      const synth = new abcjs.synth.CreateSynth();
      await synth.init({
        visualObj: visualObjRef.current[0],
        options: {
          soundFontUrl: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/",
        },
      });

      await synth.prime();
      synthRef.current = synth;
      
      synth.start();
      setIsPlaying(true);

      // Listen for end of playback
      const checkPlaybackEnded = setInterval(() => {
        // Check if playback has finished
        if (synth.getIsRunning && !synth.getIsRunning()) {
          setIsPlaying(false);
          clearInterval(checkPlaybackEnded);
        }
      }, 500);

    } catch (err) {
      console.error("Audio playback error:", err);
      setIsPlaying(false);
    }
  }, [isPlaying]);

  return (
    <div className="relative w-full h-full">
      {/* Hidden audio control div */}
      <div ref={audioControlRef} className="hidden" />
      
      {/* Play/Stop Button */}
      <button
        onClick={handlePlayStop}
        className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-md transition-colors shadow-md"
      >
        {isPlaying ? (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            Stop
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            Play
          </>
        )}
      </button>

      {/* Sheet Music Container */}
      <div
        ref={containerRef}
        className="abcjs-container w-full h-full overflow-auto bg-white p-4 rounded-lg pt-12"
      />
    </div>
  );
}
