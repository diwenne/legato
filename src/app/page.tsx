"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import AbcRenderer from "@/components/AbcRenderer";

const DEFAULT_ABC = `X:1
T:Legato Demo
M:4/4
L:1/8
K:C
V:1 clef=treble name="Right Hand"
|: c2 e2 g2 c'2 | d'2 c'2 b2 g2 | a2 g2 f2 e2 | d2 c2 B2 c2 :|
V:2 clef=bass name="Left Hand"
|: C,4 E,4 | G,4 E,4 | F,4 D,4 | G,4 C,4 :|
`;

export default function Home() {
  const [abcNotation, setAbcNotation] = useState(DEFAULT_ABC);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleNotationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAbcNotation(e.target.value);
  };

  const handleElementClick = useCallback(
    (position: { start: number; end: number }) => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(position.start, position.end);
        // Scroll to the selection
        const lineNumber = abcNotation
          .substring(0, position.start)
          .split("\n").length;
        const lineHeight = 24; // approximate
        textareaRef.current.scrollTop = (lineNumber - 1) * lineHeight;
      }
    },
    [abcNotation]
  );

  // Keyboard shortcut for future AI integration (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // TODO: Open AI command modal
        console.log("Cmd+K pressed - AI command modal placeholder");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight font-[family-name:var(--font-playfair)]">
            <span className="text-white">Legato</span>
          </h1>
          <span className="text-xs text-zinc-500">The AI-Native Composer</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-1 rounded">
            Cmd+K for AI
          </span>
        </div>
      </header>

      {/* Main Split View */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Pane: Code Editor */}
        <div className="w-1/2 flex flex-col border-r border-zinc-700">
          <div className="px-4 py-2 border-b border-zinc-700 bg-zinc-800 text-xs text-zinc-400">
            ABC Notation (Source)
          </div>
          <textarea
            ref={textareaRef}
            value={abcNotation}
            onChange={handleNotationChange}
            className="flex-1 w-full p-4 bg-zinc-950 text-zinc-100 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            spellCheck={false}
            placeholder="Type ABC notation here..."
          />
        </div>

        {/* Right Pane: Sheet Music Preview */}
        <div className="w-1/2 flex flex-col bg-zinc-100">
          <div className="px-4 py-2 border-b border-zinc-300 bg-zinc-200 text-xs text-zinc-600">
            Sheet Music Preview
          </div>
          <div className="flex-1 overflow-auto">
            <AbcRenderer
              notation={abcNotation}
              onElementClick={handleElementClick}
            />
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <footer className="px-6 py-2 border-t border-zinc-700 bg-zinc-800 text-xs text-zinc-500 flex justify-between">
        <span>Grand Staff (Piano)</span>
        <span>
          {abcNotation.split("\n").length} lines
        </span>
      </footer>
    </div>
  );
}
