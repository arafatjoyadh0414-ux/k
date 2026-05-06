import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Voice search button using Web Speech API (browser-native, free, no backend).
 * Supports English (en-US) and Bengali (bn-BD) — toggled via the `lang` prop.
 *
 * Props:
 *   - onTranscript(text): called with the recognised query
 *   - lang: "en" | "bn"  (default "en")
 */
const VoiceSearchButton = ({ onTranscript, lang = "en", testid = "voice-search-btn" }) => {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice search not supported in this browser. Try Chrome.");
      return;
    }
    const rec = new SR();
    rec.lang = lang === "bn" ? "bn-BD" : "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed") {
        toast.error("Microphone permission denied. Allow it in your browser settings.");
      } else if (e.error !== "aborted") {
        toast.error(`Voice error: ${e.error}`);
      }
    };
    rec.onend = () => setListening(false);
    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (text) {
        onTranscript?.(text);
        toast.success(`Heard: "${text}"`);
      } else {
        toast.error("Couldn't catch that — try again");
      }
    };
    recRef.current = rec;
    try { rec.start(); } catch (err) { /* already started */ }
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch (e) { /* noop */ }
    setListening(false);
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      data-testid={testid}
      onClick={listening ? stop : start}
      title={listening ? "Stop listening" : `Voice search (${lang === "bn" ? "Bangla" : "English"})`}
      aria-label="Voice search"
      className={`inline-flex items-center justify-center w-10 h-10 rounded-sm border transition-colors ${listening ? "bg-[#E11D48] text-white border-[#E11D48] animate-pulse" : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/10 hover:border-[#E11D48] hover:text-[#E11D48]"}`}
    >
      {listening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
};

export default VoiceSearchButton;
