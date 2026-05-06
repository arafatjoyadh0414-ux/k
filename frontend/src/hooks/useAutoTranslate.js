/**
 * Auto-translation engine.
 *
 * When the language is set to Bengali (bn), this hook walks the visible DOM,
 * collects English text-node strings, sends them to /api/i18n/translate
 * (Claude Sonnet 4.5 via emergentintegrations + DB cache), and replaces the
 * text in-place. The original English is stashed on each node so we can
 * restore it instantly when the user toggles back to English.
 *
 * Translations are cached in localStorage too — first paint after any visit
 * is instant for previously-seen strings.
 */
import { useEffect, useRef } from "react";
import api from "../lib/api";
import { useLang } from "../context/LanguageContext";

const STORAGE_KEY = "ja_i18n_cache_bn_v1";
const ORIG_ATTR = "__joy_i18n_original__"; // attached to text-node-containing element
const TRANSLATED_FLAG = "data-i18n-bn";

// Skip these tags entirely — never translate their text contents
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "CODE", "PRE", "KBD", "SAMP", "TT",
  "INPUT", "TEXTAREA", "OPTION", "SELECT",
]);
const SKIP_CLASS_RE = /\b(font-mono|tabular-nums|joy-no-translate|ticker-track)\b/;

const isTrivial = (s) =>
  !s ||
  s.length < 2 ||
  s.length > 600 ||
  /^[\d\s\W_·•★●◆◇—–\-→←↑↓✓×]+$/.test(s);

const loadCache = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
};
const saveCache = (cache) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch (_) { /* over quota */ }
};

const collectTextNodes = () => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue?.trim();
      if (!text || isTrivial(text)) return NodeFilter.FILTER_REJECT;
      // Climb up — reject if any ancestor is in SKIP set
      let p = node.parentElement;
      while (p) {
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.classList && SKIP_CLASS_RE.test(p.className?.toString?.() || "")) return NodeFilter.FILTER_REJECT;
        if (p.getAttribute && p.getAttribute("data-no-translate") === "true") return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
};

const applyTranslations = (nodes, dict) => {
  for (const node of nodes) {
    const orig = node.nodeValue;
    const trimmed = orig.trim();
    const translated = dict[trimmed];
    if (!translated || translated === trimmed) continue;
    if (!node[ORIG_ATTR]) node[ORIG_ATTR] = orig;
    // Preserve the original leading/trailing whitespace
    const leading = orig.match(/^\s*/)[0];
    const trailing = orig.match(/\s*$/)[0];
    node.nodeValue = leading + translated + trailing;
    // Tag the parent for later restore + to avoid re-translating
    if (node.parentElement) node.parentElement.setAttribute(TRANSLATED_FLAG, "1");
  }
};

const restoreOriginals = () => {
  // Walk all text nodes, restore from stashed original if present
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (n[ORIG_ATTR]) {
      n.nodeValue = n[ORIG_ATTR];
      delete n[ORIG_ATTR];
    }
  }
  document.querySelectorAll(`[${TRANSLATED_FLAG}]`).forEach((el) => el.removeAttribute(TRANSLATED_FLAG));
};

const useAutoTranslate = () => {
  const { lang } = useLang();
  const lastLang = useRef("en");
  const inflight = useRef(false);
  const debounce = useRef(null);

  useEffect(() => {
    // Lang changed → either run or restore
    if (lang === "en" && lastLang.current === "bn") {
      restoreOriginals();
    }
    lastLang.current = lang;

    if (lang !== "bn") return;

    const run = async () => {
      if (inflight.current) return;
      const nodes = collectTextNodes();
      if (!nodes.length) return;

      // Dedupe trimmed strings
      const cache = loadCache();
      const seen = new Set();
      const need = [];
      const localDict = {};

      for (const node of nodes) {
        const t = node.nodeValue.trim();
        if (seen.has(t)) continue;
        seen.add(t);
        if (cache[t]) {
          localDict[t] = cache[t];
        } else {
          need.push(t);
        }
      }

      // Apply cached translations IMMEDIATELY (no waiting on network)
      if (Object.keys(localDict).length) applyTranslations(nodes, localDict);

      if (!need.length) return;

      inflight.current = true;
      try {
        // Chunk to keep request payloads sane
        const CHUNK = 60;
        for (let i = 0; i < need.length; i += CHUNK) {
          const slice = need.slice(i, i + CHUNK);
          const res = await api.post("/i18n/translate", { lang: "bn", texts: slice });
          const dict = res.data?.translations || {};
          // Update cache + apply
          Object.assign(cache, dict);
          applyTranslations(collectTextNodes(), dict);
        }
        saveCache(cache);
      } catch (e) {
        // Silent fail — keep original English so the page is still usable
        // eslint-disable-next-line no-console
        console.warn("i18n auto-translate failed:", e?.message);
      } finally {
        inflight.current = false;
      }
    };

    // Initial run (debounced) + observer for dynamically rendered content
    const trigger = () => {
      clearTimeout(debounce.current);
      debounce.current = setTimeout(() => { run(); }, 250);
    };
    trigger();

    const mo = new MutationObserver(() => { if (lastLang.current === "bn") trigger(); });
    mo.observe(document.body, { childList: true, subtree: true, characterData: false });

    return () => {
      mo.disconnect();
      clearTimeout(debounce.current);
    };
  }, [lang]);
};

export default useAutoTranslate;
