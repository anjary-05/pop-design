// Modèles OO pour les éléments visuels (architecture orientée entités/fabriques,
// inspirée des moteurs de jeu : entités sérialisables, registre de fabriques,
// comportements polymorphes via composition/surcharge).

import { Registry } from "./registry.js";

/** Entité de base : identité, type, état et données sérialisables. */
export class Entity {
  constructor(input = {}) {
    const { id, kind, type, enabled, actif, ...props } = input;
    this.id = normalizeId(id ?? kind ?? type ?? "entity");
    this.kind = String(kind ?? type ?? "entity").trim() || "entity";
    this.enabled = enabled !== false && actif !== false;
    this.props = { ...props };
  }

  get(key, fallback) {
    const value = this.props[key];
    if (value === undefined || value === null) return fallback;
    if (typeof value === "string" && value.trim() === "") return fallback;
    return value;
  }

  set(key, value) {
    this.props[key] = value;
    return this;
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.props, key);
  }

  clone(overrides = {}) {
    return new this.constructor({ ...this.toJSON(), ...overrides });
  }

  toJSON() {
    return { id: this.id, kind: this.kind, enabled: this.enabled, ...this.props };
  }
}

/** Élément visuel (props immuables pour compatibilité). */
export class VisualElement extends Entity {
  constructor(input = {}) {
    super(input);
    this.props = Object.freeze({ ...this.props });
  }
}

/** Tuile cliquable : icône, libellé, cible de panneau et contenu. */
export class TileModel extends VisualElement {
  constructor(input = {}) {
    super({ ...input, kind: input.kind ?? input.type ?? "text" });
    this.icon = stringOr(input.icone ?? input.icon ?? input.props?.icone, "comments");
    this.label = stringOr(input.libelle ?? input.label ?? input.props?.libelle, this.id);
    this.description = stringOr(input.description, "");
    this.panelId = stringOr(input.panneau ?? input.panel ?? input.panelId, this.id);
    this.title = stringOr(input.titre ?? input.title, this.label);
    this.text = stringOr(input.texte ?? input.text, "");
    this.image = stringOr(input.image, "");
    this.accent = stringOr(input.couleur ?? input.accent, "");
  }

  toJSON() {
    return {
      id: this.id,
      type: this.kind,
      enabled: this.enabled,
      icone: this.icon,
      libelle: this.label,
      ...(this.description === "" ? {} : { description: this.description }),
      panneau: this.panelId,
      titre: this.title,
      ...(this.text === "" ? {} : { texte: this.text }),
      ...(this.image === "" ? {} : { image: this.image }),
      ...(this.accent === "" ? {} : { couleur: this.accent }),
    };
  }
}

/** Panneau modal : type de rendu, titre, texte, images et icône (fallback). */
export class PanelModel extends VisualElement {
  constructor(input = {}) {
    super({ ...input, kind: input.kind ?? input.type ?? "text" });
    this.title = stringOr(input.title ?? input.titre, "");
    this.text = stringOr(input.text ?? input.texte, "");
    this.images = Array.isArray(input.images)
      ? input.images.filter((entry) => typeof entry === "string" && entry.trim() !== "")
      : [];
    this.members = Array.isArray(input.members)
      ? input.members
          .filter((entry) => entry !== null && typeof entry === "object" && !Array.isArray(entry))
          .map((entry) => ({
            name: stringOr(entry.name, ""),
            role: stringOr(entry.role, ""),
            image: stringOr(entry.image, ""),
          }))
          .filter((entry) => entry.name !== "" || entry.role !== "" || entry.image !== "")
      : [];
    this.icon = stringOr(input.icon ?? input.icone, "");
    this.tileId = stringOr(input.tileId ?? input.tile, "");
    this.maxItems = Number.isFinite(input.maxItems) ? Math.max(1, Math.min(8, input.maxItems)) : null;
    this.tile = input.element instanceof TileModel ? input.element : null;
  }

  toJSON() {
    return {
      id: this.id,
      kind: this.kind,
      enabled: this.enabled,
      title: this.title,
      text: this.text,
      images: [...this.images],
      ...(this.members.length > 0 ? { members: this.members } : {}),
      ...(this.icon ? { icon: this.icon } : {}),
      ...(this.maxItems === null ? {} : { maxItems: this.maxItems }),
      tileId: this.tileId,
    };
  }
}

// Registre de fabriques d'éléments (extensible).
export const elementRegistry = new Registry("elements", [
  ["tile", (input) => new TileModel(input)],
  ["panel", (input) => new PanelModel(input)],
]);

/** Enregistre une fabrique pour un nouveau type d'élément visuel. */
export function registerElementModel(key, factory) {
  if (typeof key !== "string" || typeof factory !== "function") return false;
  elementRegistry.register(key, factory);
  return true;
}

/** Construit un modèle depuis une description sérialisable. */
export function createElementModel(key, input = {}) {
  const factory = elementRegistry.get(key);
  return factory ? factory(input) : new VisualElement(input);
}

/** Supprime les doublons d'identifiant en gardant le premier. */
export function uniqueElements(elements) {
  const seen = new Set();
  const out = [];
  for (const element of elements) {
    if (!(element instanceof VisualElement) || !element.enabled) continue;
    const base = element.id;
    let id = base;
    let index = 2;
    while (seen.has(id)) {
      id = `${base}_${index}`;
      index += 1;
    }
    if (id !== base) element.id = id;
    seen.add(id);
    out.push(element);
  }
  return out;
}

/** Cherche un élément par identifiant. */
export function findElement(elements, id) {
  return elements.find((element) => element.id === id) ?? null;
}

export function normalizeId(value) {
  const text = String(value ?? "element")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text === "" ? "element" : text.slice(0, 48);
}

function stringOr(value, fallback) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? fallback : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}
