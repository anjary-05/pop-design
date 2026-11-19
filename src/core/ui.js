// Composition du modèle d'interface (OOP) : assemble design, tuiles, panneaux,
// configuration de discussion et contenus interpolés via un orchestrateur.

import { BUNDLED, imageUrl, resolveAvatar, resolveLogo } from "./assets.js";
import { normalizeChatConfig, interpolate } from "./chat.js";
import { buildDesign } from "./design.js";
import { PanelModel, TileModel } from "./element.js";
import { boolParam, textParam } from "./params.js";
import { createPanels, normalizeTiles } from "./tiles.js";
import { createStructuredSections } from "./sections.js";
import { buildView, viewRegistry } from "./view-registry.js";
import { buildAppInterface } from "./interface.js";

const CAPABILITY_NAMES = Object.freeze([
  "messages", "media", "modelForm", "theme", "userState", "knowledge", "attachments", "fallback",
]);

export function hasCapability(capabilities, name) {
  return Array.isArray(capabilities) && capabilities.includes(name);
}

export class UIComposer {
  constructor(config = {}) {
    this.capabilityNames = config.capabilityNames ?? CAPABILITY_NAMES;
  }

  parseDesignOverrides(params) {
    try {
      const raw = typeof params?.design_json === "string" ? params.design_json : "{}";
      const parsed = JSON.parse(raw);
      return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  compose(ctx = {}, params = {}, capabilities = []) {
    const brandName = textParam(params, "nom_assistant") || ctx.brand?.name || "";
    const effectiveCtx = brandName === "" ? ctx : { ...ctx, brand: { ...(ctx.brand ?? {}), name: brandName } };
    const i = (value) => interpolate(value, effectiveCtx);
    const design = buildDesign(params, ctx.theme ?? {});

    const structured = createStructuredSections(params);
    const sourceTiles = structured.hasSections ? structured.tiles : normalizeTiles(params);
    const sourcePanels = structured.hasSections ? structured.panels : createPanels(params, sourceTiles);

    const tiles = sourceTiles.map((tile) => new TileModel({
      ...tile.toJSON(),
      libelle: i(tile.label),
      description: i(tile.description),
      titre: i(tile.title),
      texte: i(tile.text),
    }));

    const panels = sourcePanels.map((panel) => {
      const model = new PanelModel({
        ...panel.toJSON(),
        title: i(panel.title),
        text: i(panel.text),
        images: panel.images.map((image) => i(image)),
        tileId: panel.tileId,
      });
      model.view = buildView(model, { params, ctx });
      return model;
    });

    const elements = this.parseDesignOverrides(params).elements ?? {};
    const chat = normalizeChatConfig(params);
    chat.accueil = i(chat.accueil);
    chat.placeholder = i(chat.placeholder);
    chat.placeholderContact = i(chat.placeholderContact);
    chat.messageVide = i(chat.messageVide);
    chat.labels = Object.fromEntries(Object.entries(chat.labels).map(([key, value]) => [key, i(value)]));
    if (chat.identity) {
      chat.identity = Object.fromEntries(
        Object.entries(chat.identity).map(([key, value]) => [key, typeof value === "string" ? i(value) : value]),
      );
    }

    const content = {
      title: i(textParam(params, "titre")),
      subtitle: i(textParam(params, "sous_titre")),
      logo: resolveLogo(params?.logo_url, ctx.brand?.logoUrl),
      background: imageUrl(params?.image_fond, BUNDLED.background),
      underline: imageUrl(params?.image_soulignement, BUNDLED.underline),
      avatarAssistant: resolveAvatar(params?.avatar_assistant_url),
      avatarUser: resolveAvatar(params?.avatar_utilisateur_url),
      identityTitle: i(textParam(params, "titre_identite")),
      identityText: i(textParam(params, "texte_identite")),
      footerText: i(textParam(params, "texte_footer")),
      footerLink: textParam(params, "lien_footer"),
      showCredit: boolParam(params, "afficher_credit"),
      brandName,
      linkLabel: ctx.link?.label ?? "",
      locale: ctx.locale ?? "fr",
      elements: {
        header: {
          logo: elements.header?.logo !== false,
          kicker: elements.header?.kicker !== false,
          title: elements.header?.title !== false,
          underline: elements.header?.underline !== false,
          subtitle: elements.header?.subtitle !== false,
        },
        footer: { visible: elements.footer?.visible !== false },
        background: { visible: elements.background?.visible !== false },
      },
    };

    const granted = new Set(this.capabilityNames.filter((name) => hasCapability(capabilities, name)));
    // Métadonnées/schémas génériques (interface schema-driven, comme AdminGen/Generic*)
    const schemas = {
      fields: {
        identity: viewRegistry.getFieldSchema("identity"),
        contactMessage: viewRegistry.getFieldSchema("contact-message"),
      },
      views: {
        tiles: tiles.map((t) => buildView(t, { params, ctx })),
        panels: panels.map((p) => p.view ?? buildView(p, { params, ctx })),
      },
    };
    const model = { design, tiles, panels, chat, content, granted, has: (name) => granted.has(name), schemas, registry: viewRegistry };
    // Arbre d'interface objet (chaque élément = objet POO paramétrable, parcourable)
    model.ui = buildAppInterface(model, ctx);
    return model;
  }
}

export const uiComposer = new UIComposer();

export function createUiModel(ctx = {}, params = {}, capabilities = []) {
  return uiComposer.compose(ctx, params, capabilities);
}
