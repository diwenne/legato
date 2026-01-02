"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import abcjs from "abcjs";

interface AbcRendererProps {
  notation: string;
  onElementClick?: (position: { start: number; end: number }) => void;
}

// Cursor control class for playback visualization
class CursorControl {
  private cursor: SVGLineElement | null = null;
  private svg: SVGSVGElement | null = null;
  private lastHighlighted: SVGElement[] = [];

  onStart() {
    // Remove any existing cursor
    if (this.cursor) {
      this.cursor.remove();
    }
  }

  onEvent(event: {
    elements?: SVGElement[][];
    measureStart?: boolean;
    left?: number;
    top?: number;
    height?: number;
  }) {
    // Remove previous highlights
    this.lastHighlighted.forEach((el) => {
      el.classList.remove("abcjs-highlight");
    });
    this.lastHighlighted = [];

    // Highlight current notes
    if (event.elements) {
      event.elements.forEach((elementGroup) => {
        elementGroup.forEach((element) => {
          if (element) {
            element.classList.add("abcjs-highlight");
            this.lastHighlighted.push(element);

            // Create/move cursor line
            if (!this.svg) {
              this.svg = element.closest("svg");
            }
            if (this.svg && event.left !== undefined && event.top !== undefined && event.height !== undefined) {
              this.updateCursor(event.left, event.top, event.height);
            }
          }
        });
      });
    }
  }

  private updateCursor(left: number, top: number, height: number) {
    if (!this.svg) return;

    if (!this.cursor) {
      this.cursor = document.createElementNS("http://www.w3.org/2000/svg", "line");
      this.cursor.setAttribute("class", "abcjs-cursor");
      this.cursor.setAttribute("stroke", "#10b981");
      this.cursor.setAttribute("stroke-width", "2");
      this.svg.appendChild(this.cursor);
    }

    this.cursor.setAttribute("x1", String(left));
    this.cursor.setAttribute("x2", String(left));
    this.cursor.setAttribute("y1", String(top));
    this.cursor.setAttribute("y2", String(top + height));
  }

  onFinished() {
    // Remove highlights and cursor
    this.lastHighlighted.forEach((el) => {
      el.classList.remove("abcjs-highlight");
    });
    this.lastHighlighted = [];
    if (this.cursor) {
      this.cursor.remove();
      this.cursor = null;
    }
  }
}

export default function AbcRenderer({
  notation,
  onElementClick,
}: AbcRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioControlRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const synthRef = useRef<any>(null);
  const visualObjRef = useRef<abcjs.TuneObject[] | null>(null);
  const cursorControlRef = useRef<CursorControl | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize and render
  useEffect(() => {
    // Only run on client side (abcjs needs DOM)
    if (typeof window === "undefined") return;
    
    if (containerRef.current && notation) {
      try {
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

        // Check if render was successful
        if (visualObj && visualObj.length > 0) {
          visualObjRef.current = visualObj;
        } else {
          visualObjRef.current = null;
          console.warn("abcjs: No valid tunes rendered from notation");
        }

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
      } catch (err) {
        console.error("abcjs render error:", err);
        visualObjRef.current = null;
      }
    }

    // Cleanup
    return () => {
      if (synthRef.current) {
        synthRef.current.stop();
        setIsPlaying(false);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (cursorControlRef.current) {
        cursorControlRef.current.onFinished();
      }
    };
  }, [notation, onElementClick]);

  const handlePlayStop = useCallback(async () => {
    if (isPlaying && synthRef.current) {
      synthRef.current.stop();
      setIsPlaying(false);
      if (cursorControlRef.current) {
        cursorControlRef.current.onFinished();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    if (!visualObjRef.current || visualObjRef.current.length === 0) return;

    try {
      // Initialize cursor control
      const cursorControl = new CursorControl();
      cursorControlRef.current = cursorControl;

      // Create synth with timing callbacks
      const synth = new abcjs.synth.CreateSynth();
      await synth.init({
        visualObj: visualObjRef.current[0],
        options: {
          soundFontUrl: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/",
        },
      });

      // Prime the audio
      await synth.prime();
      synthRef.current = synth;

      // Start cursor
      cursorControl.onStart();

      // Setup timing callback using abcjs TimingCallbacks
      const timingCallbacks = new abcjs.TimingCallbacks(visualObjRef.current[0], {
        eventCallback: (event: unknown) => {
          if (event) {
            cursorControl.onEvent(event as Parameters<CursorControl["onEvent"]>[0]);
          } else {
            // Playback finished
            cursorControl.onFinished();
            setIsPlaying(false);
          }
          return undefined;
        },
      });

      // Start playback
      synth.start();
      timingCallbacks.start();
      setIsPlaying(true);

    } catch (err) {
      console.error("Audio playback error:", err);
      setIsPlaying(false);
    }
  }, [isPlaying]);

  // Pro playback using Python backend
  const [isProLoading, setIsProLoading] = useState(false);
  const [isProPlaying, setIsProPlaying] = useState(false);
  const proAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayPro = useCallback(async () => {
    // Stop if already playing
    if (proAudioRef.current) {
      proAudioRef.current.pause();
      proAudioRef.current = null;
      setIsProPlaying(false);
      return;
    }

    setIsProLoading(true);
    
    try {
      const response = await fetch("http://localhost:8000/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abc: notation }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Synthesis failed");
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(audioUrl);
      proAudioRef.current = audio;
      
      audio.onended = () => {
        proAudioRef.current = null;
        setIsProPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
      setIsProPlaying(true);
    } catch (err) {
      console.error("Pro playback error:", err);
      alert(`Pro playback error: ${err}`);
    } finally {
      setIsProLoading(false);
    }
  }, [notation]);

  return (
    <div className="relative w-full h-full">
      {/* Hidden audio control div */}
      <div ref={audioControlRef} className="hidden" />
      
      {/* Play Button */}
      <button
        onClick={handlePlayPro}
        disabled={isProLoading}
        className="absolute top-2 right-2 z-10 flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-medium rounded-md transition-colors shadow-md"
        title="High-quality playback (FluidSynth)"
      >
        {isProLoading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Synthesizing...
          </>
        ) : isProPlaying ? (
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
