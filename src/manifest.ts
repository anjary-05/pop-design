// Manifeste du template.
//
// Objet simple (et non `defineManifest`) : le type `image` est une extension
// du dashboard absente du SDK 0.2.0. `defineManifest` projetterait les
// paramètres sur les types connus et supprimerait les huit visuels.
// Le plugin Vite complète `schemaVersion`, `kind`, `compatibility`, `ui.entry`
// et `ui.integrity` à partir du bundle réel.
import { PARAM_DEFINITIONS } from "./core/params.js";

const manifest = {
  schemaVersion: 1,
  kind: "template",
  id: "pop-design",
  name: "Pop Design",
  description:
    "Template générique : en-tête sur photo, tuiles à fenêtres, galerie et chatbot paramétrable (Markdown, suggestions, pièces jointes, secours).",
  version: "2.6.6",
  publisher: { id: "onirtech", name: "ONIRTECH", trustLevel: "official" },
  compatibility: { hostProtocol: "onirtech.template-host.v1" },
  ui: {
    mode: "web-component",
    entry: "./dist/index.js",
    element: "onirtech-template-pop-design",
    shadowDom: "open",
    widget: {
      entry: "./dist/widget.js",
      element: "onirtech-widget-pop-design",
      display: {
        defaultPosition: "bottom-right",
        allowedPositions: ["bottom-right", "bottom-left"],
        closedSize: { width: 64, height: 64 },
        openSize: { width: 420, height: 680 },
        maxSize: { width: 520, height: 760 },
      },
    },
  },
  capabilities: [
    "messages",
    "media",
    "theme",
    "fallback",
    "knowledge",
    "userState",
  ],
  params: PARAM_DEFINITIONS,
};

export default manifest;