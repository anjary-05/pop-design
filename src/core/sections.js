// Sections structurées : rôle métier, rendu structurel et contenu séparés.
// Ce modèle est prioritaire sur l'ancien `tuiles_json` quand il est renseigné.

import { BUNDLED, imageUrl } from "./assets.js";
import { PanelModel, TileModel, uniqueElements, normalizeId } from "./element.js";

const SECTION_TYPES = new Set(["card", "text", "image", "grid", "form"]);
const SECTION_LAYOUTS = new Set(["hero", "split", "stack", "media"]);

function text(value, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? fallback : trimmed;
  }
  return fallback;
}

function strings(value) {
  return Array.isArray(value)
    ? value.map((entry) => text(entry)).filter((entry) => entry !== "")
    : [];
}

function parseRaw(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function panelKind(render) {
  const type = SECTION_TYPES.has(render.type) ? render.type : "card";
  if (type === "grid") return "gallery";
  if (type === "form") return "contact";
  if (type === "card" && render.layout === "hero") return "welcome";
  if (type === "card" && (render.layout === "split" || render.layout === "members")) return "team";
  return "text";
}

function members(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry !== null && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      name: text(entry.name, "John Doe"),
      role: text(entry.role),
      image: text(entry.image),
    }))
    .filter((entry) => entry.name !== "" || entry.role !== "" || entry.image !== "")
    .slice(0, 8);
}

function panelImages(kind, images, params) {
  if (images.length > 0) return images;
  if (kind === "welcome") {
    return [
      imageUrl(params?.image_welcome_1, BUNDLED.welcome1),
      imageUrl(params?.image_welcome_2, BUNDLED.welcome2),
    ];
  }
  if (kind === "team") return [imageUrl(params?.image_equipe, BUNDLED.team)];
  return [];
}

/** Convertit `sections[]` en tuiles/panneaux compatibles avec le moteur UI actuel. */
export function createStructuredSections(params = {}) {
  const source = parseRaw(params?.sections);
  const tiles = [];
  const panels = [];
  for (const [index, raw] of source.entries()) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
    if (raw.enabled === false) continue;
    const nav = raw.navigation ?? {};
    const render = raw.render ?? {};
    const content = raw.content ?? {};
    const id = normalizeId(raw.id ?? `section-${index + 1}`);
    const label = text(nav.label, text(content.title, id));
    const title = text(content.title, label);
    const description = text(content.description);
    const body = [description, text(content.text)].filter(Boolean).join("\n\n");
    const images = strings(content.images);
    const kind = panelKind(render);
    const rawMax = render.max_items ?? render.maxItems;
    const maxItems = Number.isFinite(Number(rawMax))
      ? Math.max(1, Math.min(8, Number(rawMax)))
      : 8;
    const tile = new TileModel({
      id,
      type: kind,
      icone: text(nav.icon, "file"),
      libelle: label,
      description,
      title,
      texte: body,
      image: images[0] ?? "",
    });
    const panel = new PanelModel({
      id,
      kind,
      title,
      text: body,
      images: panelImages(kind, images, params),
      members: members(content.members),
      icon: text(nav.icon, "file"),
      tileId: id,
      element: tile,
    });
    panel.maxItems = maxItems;
    tiles.push(tile);
    panels.push(panel);
  }
  return {
    hasSections: source.length > 0,
    tiles: uniqueElements(tiles),
    panels,
  };
}
