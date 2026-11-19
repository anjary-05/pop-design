// Tests des modèles « core » : paramètres, design, assets, tuiles, chat et
// éléments visuels. Aucun rendu : on vérifie les contrats purs consommés par
// les composants.

import { describe, expect, it } from "vitest";
import { imageUrl, resolveAvatar, resolveLogo } from "../src/core/assets.js";
import {
  CONTACT_TYPES,
  buildContact,
  contactTypeFor,
  formatBytes,
  formatTime,
  interpolate,
  normalizeChatConfig,
  normalizeMessages,
  parseSuggestions,
  shouldShowSuggestions,
} from "../src/core/chat.js";
import { buildDesign, contrastInk } from "../src/core/design.js";
import { createUiModel } from "../src/core/ui.js";
import { createStructuredSections } from "../src/core/sections.js";
import { PanelModel, TileModel, uniqueElements } from "../src/core/element.js";
import {
  DEFAULTS,
  MAX_MESSAGE,
  PARAM_DEFINITIONS,
  boolParam,
  isCustomized,
  paramValue,
  parseJsonParam,
  textParam,
} from "../src/core/params.js";
import {
  canonicalIcon,
  canonicalTileKind,
  createPanels,
  normalizeTiles,
} from "../src/core/tiles.js";

describe("paramètres publics", () => {
  it("expose exactement 42 paramètres valides pour le contrat hôte", () => {
    expect(PARAM_DEFINITIONS).toHaveLength(42);

    const keys = PARAM_DEFINITIONS.map((param) => param.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(Object.keys(DEFAULTS).sort()).toEqual([...keys].sort());
    expect(Object.isFrozen(DEFAULTS)).toBe(true);

    for (const param of PARAM_DEFINITIONS) {
      expect(param.key).toMatch(/^[a-z][a-z0-9_]{1,40}$/);
      expect(param.label.trim()).not.toBe("");
      expect(param.description.trim()).not.toBe("");
      if (param.type === "boolean") {
        expect(typeof param.default).toBe("boolean");
      } else if (param.type === "number") {
        expect(typeof param.default).toBe("number");
      } else if (param.type === "array") {
        expect(Array.isArray(param.default)).toBe(true);
      } else if (param.type === "object") {
        expect(param.default !== null && typeof param.default === "object").toBe(true);
      } else {
        expect(typeof param.default).toBe("string");
      }
      if (param.type === "select") {
        expect(param.options.some((option) => option.value === param.default)).toBe(true);
      }
      if (param.maxLength && typeof param.default === "string") {
        expect(param.default.length).toBeLessThanOrEqual(param.maxLength);
      }
    }

    // Contrainte hôte : 16 Ko de schéma JSON maximum.
    expect(JSON.stringify(PARAM_DEFINITIONS).length).toBeLessThanOrEqual(16 * 1024);
  });

  it("déclare huit paramètres image avec un défaut vide", () => {
    const images = PARAM_DEFINITIONS.filter((param) => param.type === "image");
    expect(images).toHaveLength(8);
    for (const param of images) expect(param.default).toBe("");
  });

  it("lit les scalaires avec repli sur le défaut", () => {
    expect(paramValue({}, "titre")).toBe("");
    expect(paramValue({ titre: "  " }, "titre")).toBe("");
    expect(paramValue({ titre: "Album" }, "titre")).toBe("Album");
    expect(paramValue({ titre: 42 }, "titre")).toBe(42);
    expect(textParam({ titre: "  Album  " }, "titre")).toBe("  Album  ");
    expect(textParam({ titre: 42 }, "titre")).toBe("");
  });

  it("tolère les booléens du harness et de l'éditeur", () => {
    expect(boolParam({ entree_envoyer: true }, "entree_envoyer")).toBe(true);
    expect(boolParam({ entree_envoyer: "1" }, "entree_envoyer")).toBe(true);
    expect(boolParam({ entree_envoyer: "true" }, "entree_envoyer")).toBe(true);
    expect(boolParam({ entree_envoyer: "0" }, "entree_envoyer")).toBe(false);
    expect(boolParam({ entree_envoyer: "false" }, "entree_envoyer")).toBe(false);
    expect(boolParam({}, "entree_envoyer")).toBe(true);
    expect(boolParam({}, "afficher_credit")).toBe(false);
  });

  it("détecte une personnalisation explicite", () => {
    expect(isCustomized({ couleur_accent: "#112233" }, "couleur_accent")).toBe(true);
    expect(isCustomized({ couleur_accent: DEFAULTS.couleur_accent }, "couleur_accent")).toBe(false);
    expect(isCustomized({ couleur_accent: "" }, "couleur_accent")).toBe(false);
    expect(isCustomized({}, "couleur_accent")).toBe(false);
  });

  it("parse les paramètres JSON de façon tolérante", () => {
    expect(parseJsonParam({}, "tuiles_json", [])).toHaveLength(4);
    expect(parseJsonParam({ tuiles_json: "{" }, "tuiles_json", [])).toEqual([]);
    expect(parseJsonParam({ tuiles_json: '{"a":1}' }, "tuiles_json", [])).toEqual([]);
    expect(parseJsonParam({ chat_json: '{"markdown":false}' }, "chat_json", {})).toEqual({
      markdown: false,
    });
    expect(parseJsonParam({ chat_json: "[]" }, "chat_json", {})).toEqual({});
    expect(parseJsonParam({ design_json: '{"accent":"#fff"}' }, "design_json", {})).toEqual({
      accent: "#fff",
    });
  });
});

describe("assets", () => {
  it("n'accepte que les URL d'image sûres", () => {
    expect(imageUrl("https://cdn.example/x.png", "fallback")).toBe("https://cdn.example/x.png");
    expect(imageUrl("data:image/png;base64,abc", "")).toBe("data:image/png;base64,abc");
    expect(imageUrl("/assets/x.png", "")).toBe("/assets/x.png");
    expect(imageUrl("./x.png", "")).toBe("./x.png");
    expect(imageUrl("javascript:alert(1)", "fallback")).toBe("fallback");
    expect(imageUrl("  ", "fallback")).toBe("fallback");
    expect(imageUrl(null, "fallback")).toBe("fallback");
    expect(imageUrl(42, "fallback")).toBe("fallback");
  });

  it("résout le logo et les avatars avec priorité au paramètre", () => {
    expect(resolveLogo(undefined, "https://brand.example/logo.png")).toBe(
      "https://brand.example/logo.png",
    );
    expect(resolveLogo("https://cdn.example/logo.png", "https://brand.example/logo.png")).toBe(
      "https://cdn.example/logo.png",
    );
    expect(resolveLogo("javascript:alert(1)", "https://brand.example/logo.png")).toBe(
      "https://brand.example/logo.png",
    );
    expect(resolveAvatar("")).toBeNull();
    expect(resolveAvatar("https://cdn.example/me.png")).toBe("https://cdn.example/me.png");
  });
});

describe("design tokens", () => {
  it("suit le thème hôte tant que l'accent n'est pas personnalisé", () => {
    const themed = buildDesign({}, { primary: "#445566" });
    expect(themed.tokens.accent).toBe("#445566");
    expect(themed.vars["--pop-accent"]).toBe("#445566");

    const explicit = buildDesign({ couleur_accent: "#112233" }, { primary: "#445566" });
    expect(explicit.tokens.accent).toBe("#112233");
  });

  it("applique les presets d'ambiance, densité, typographie et arrondi", () => {
    const light = buildDesign({ ambiance: "clair" }, {});
    expect(light.tokens.surface).toBe("#ffffff");
    expect(light.tokens.text).toBe("#0f172a");
    expect(light.className).toContain("pop--clair");

    const compact = buildDesign({ densite: "compact", arrondi: "arrondi" }, {});
    expect(compact.vars["--pop-gap"]).toBe("11px");
    expect(compact.vars["--pop-radius"]).toBe("20px");
    expect(compact.className).toContain("pop--compact");
    expect(compact.className).toContain("pop--arrondi");
  });

  it("accepte les surcharges design_json et rejette les valeurs dangereuses", () => {
    const custom = buildDesign(
      { design_json: '{"accent":"#ff0055","rayon":12,"police":"monospace"}' },
      {},
    );
    expect(custom.vars["--pop-accent"]).toBe("#ff0055");
    expect(custom.vars["--pop-radius"]).toBe("12px");
    expect(custom.vars["--pop-font"]).toBe("monospace");

    const unsafe = buildDesign(
      { design_json: '{"accent":"red;background:url(x)","rayon":"1px;}"}' },
      {},
    );
    expect(unsafe.vars["--pop-accent"]).toBe("#006599");
    expect(unsafe.vars["--pop-radius"]).toBe("20px");
    expect(Object.values(unsafe.vars).join(" ")).not.toContain("javascript:");
  });

  it("choisit une couleur de texte lisible", () => {
    expect(contrastInk("#ffffff")).toBe("#10151c");
    expect(contrastInk("#000000")).toBe("#ffffff");
    expect(contrastInk("pas-une-couleur")).toBe("#ffffff");
  });
});

describe("discussion", () => {
  it("fusionne chat_json avec les paramètres dédiés", () => {
    const config = normalizeChatConfig({
      chat_json: JSON.stringify({
        markdown: false,
        avatars: false,
        horodatage: true,
        accueil: "Salut",
        maxLength: 50,
        suggestions: ["A", "A", "B"],
        libelles: { pieces: "Fichiers" },
      }),
      entree_envoyer: false,
    });

    expect(config.markdown).toBe(false);
    expect(config.avatars).toBe(false);
    expect(config.horodatage).toBe(true);
    expect(config.accueil).toBe("Salut");
    expect(config.maxLength).toBe(50);
    expect(config.suggestions).toEqual(["A", "B"]);
    expect(config.labels.pieces).toBe("Fichiers");
    expect(config.entreeEnvoyer).toBe(false);
  });

  it("borne maxLength entre 1 et MAX_MESSAGE", () => {
    expect(normalizeChatConfig({ chat_json: '{"maxLength":99999}' }).maxLength).toBe(MAX_MESSAGE);
    expect(normalizeChatConfig({ chat_json: '{"maxLength":0}' }).maxLength).toBe(1);
    expect(normalizeChatConfig({ chat_json: '{"maxLength":"abc"}' }).maxLength).toBe(MAX_MESSAGE);
  });

  it("nettoie, déduplique et limite les suggestions", () => {
    expect(parseSuggestions("A\nB|C;D")).toEqual(["A", "B", "C", "D"]);
    expect(parseSuggestions("  A  \nA\n\nB ")).toEqual(["A", "B"]);
    expect(parseSuggestions(Array.from({ length: 10 }, (_, index) => `S${index}`))).toHaveLength(8);
    expect(parseSuggestions("x".repeat(200))[0]).toHaveLength(140);
    expect(parseSuggestions(null)).toEqual([]);
  });

  it("normalise les messages et filtre les médias invalides", () => {
    const messages = normalizeMessages([
      null,
      "texte",
      {
        role: "user",
        content: "Bonjour",
        medias: [
          { type: "photo", url: "https://x.example/p.jpg" },
          { type: "video", url: "https://x.example/v.mp4" },
          { type: "lien", url: "" },
        ],
        attachments: [
          { id: "a1", originalName: "f.pdf" },
          { id: "a2" },
        ],
      },
      { id: "assistant-1", role: "admin", content: 42, medias: "nope" },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ id: "message-0", role: "user", content: "Bonjour" });
    expect(messages[0].medias).toHaveLength(1);
    expect(messages[0].attachments).toHaveLength(1);
    expect(messages[1]).toMatchObject({
      id: "assistant-1",
      role: "assistant",
      content: "",
    });
    expect(messages[1].medias).toEqual([]);
  });

  it("affiche les suggestions seulement avant le premier message visiteur", () => {
    const config = normalizeChatConfig({ suggestions: "A\nB" });
    expect(shouldShowSuggestions(config, [])).toBe(true);
    expect(shouldShowSuggestions(config, [{ role: "user" }])).toBe(false);
    expect(shouldShowSuggestions({ ...config, suggestionsToujours: true }, [{ role: "user" }])).toBe(
      true,
    );
    expect(shouldShowSuggestions({ ...config, afficherSuggestions: false }, [])).toBe(false);
    expect(shouldShowSuggestions({ ...config, suggestions: [] }, [])).toBe(false);
  });

  it("convertit les champs modelForm en types de contact acceptés", () => {
    expect(CONTACT_TYPES).toEqual(["téléphone", "whatsapp", "site web", "autre"]);
    expect(contactTypeFor({ name: "telephone", label: "Téléphone" })).toBe("téléphone");
    expect(contactTypeFor({ name: "whatsapp", label: "WhatsApp" })).toBe("whatsapp");
    expect(contactTypeFor({ name: "site", label: "Site web" })).toBe("site web");
    expect(contactTypeFor({ name: "url", label: "Adresse", type: "url" })).toBe("site web");
    expect(contactTypeFor({ name: "sujet", label: "Sujet" })).toBe("autre");

    expect(buildContact({ name: "sujet", label: "Sujet" }, "Devis")).toEqual({
      type: "autre",
      valeur: "Sujet : Devis",
    });
    expect(buildContact({ name: "phone", label: "Téléphone" }, "034 00 000")).toEqual({
      type: "téléphone",
      valeur: "034 00 000",
    });
    expect(buildContact({ name: "url", label: "Site", type: "url" }, "https://x.mg")).toEqual({
      type: "site web",
      valeur: "https://x.mg",
    });
    expect(buildContact({ name: "budget", label: "Budget" }, ["1 M", "2 M"])).toEqual({
      type: "autre",
      valeur: "Budget : 1 M, 2 M",
    });
    expect(buildContact({ name: "sujet", label: "Sujet" }, "  ")).toBeNull();
  });

  it("formate les tailles, les heures et les variables", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(2048)).toBe("2.0 Ko");
    expect(formatBytes(10 * 1024)).toBe("10 Ko");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 Mo");
    expect(formatBytes(-1)).toBe("");

    const time = formatTime("2026-01-01T10:30:00Z", "fr");
    expect(typeof time).toBe("string");
    expect(time).not.toBe("");
    expect(formatTime("pas-une-date")).toBe("");

    const text = interpolate("Bonjour {marque} — {lien} {annee}", {
      brand: { name: "ACME" },
      link: { label: "Campagne" },
    });
    expect(text).toContain("ACME");
    expect(text).toContain("Campagne");
    expect(text).toContain(String(new Date().getFullYear()));
  });
});

describe("sections structurées", () => {
  const sections = [
    { id: "welcome", role: "welcome", navigation: { label: "Bienvenue", icon: "home" }, render: { type: "card", layout: "hero" }, content: { title: "Bienvenue", text: "Texte" } },
    { id: "team", role: "team", navigation: { label: "Équipe", icon: "users" }, render: { type: "card", layout: "members" }, content: { title: "Équipe", text: "Notre équipe", members: [{ name: "John Doe", role: "Fondateur", image: "https://exemple.com/john.jpg" }] } },
    { id: "catalogue", role: "catalogue", navigation: { label: "Produits", icon: "handshake" }, render: { type: "grid", layout: "media", source: "medias", max_items: 3 }, content: { title: "Produits" } },
    { id: "services", role: "services", navigation: { label: "Services", icon: "file" }, render: { type: "text", layout: "stack" }, content: { title: "Services", text: "Conseil" } },
    { id: "contact", role: "contact", navigation: { label: "Contact", icon: "comments" }, render: { type: "form", layout: "stack", source: "contact" }, content: { title: "Contact" } },
  ];

  it("convertit rôle, rendu et contenu en tuiles et panneaux", () => {
    const result = createStructuredSections({ sections });
    expect(result.hasSections).toBe(true);
    expect(result.tiles.map((tile) => tile.kind)).toEqual([
      "welcome", "team", "gallery", "text", "contact",
    ]);
    expect(result.panels.map((panel) => panel.kind)).toEqual([
      "welcome", "team", "gallery", "text", "contact",
    ]);
    expect(result.panels[1].members).toEqual([
      { name: "John Doe", role: "Fondateur", image: "https://exemple.com/john.jpg" },
    ]);
    expect(result.panels[2].maxItems).toBe(3);
  });

  it("ignore les sections désactivées", () => {
    const result = createStructuredSections({ sections: [sections[0], { ...sections[1], enabled: false }] });
    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0].kind).toBe("welcome");
  });
});

describe("identité de l'assistant", () => {
  it("surcharge le nom de l'organisation avec nom_assistant", () => {
    const model = createUiModel(
      { brand: { name: "ONIRTECH" } },
      { nom_assistant: "Maison Kolo", sous_titre: "Bonjour {marque}" },
      [],
    );
    expect(model.content.brandName).toBe("Maison Kolo");
    expect(model.content.subtitle).toBe("Bonjour Maison Kolo");
  });

  it("retombe sur le nom de l'organisation quand nom_assistant est vide", () => {
    const model = createUiModel({ brand: { name: "ONIRTECH" } }, {}, []);
    expect(model.content.brandName).toBe("ONIRTECH");
  });
});

describe("tuiles et panneaux", () => {
  const DEFAULT_TILES_JSON = JSON.stringify([
    { id: "welcome", type: "welcome", icone: "home", libelle: "Bienvenue", description: "Présentation" },
    { id: "equipe", type: "team", icone: "users", libelle: "Notre équipe", description: "Qui nous sommes" },
    { id: "realisations", type: "gallery", icone: "handshake", libelle: "Nos réalisations", description: "Galerie" },
    { id: "contact", type: "contact", icone: "comments", libelle: "Contact", description: "Écrire" },
  ]);

  it("produit les tuiles de structure par défaut (éléments toujours présents)", () => {
    const tiles = normalizeTiles({});
    expect(tiles.map((tile) => tile.kind)).toEqual(["welcome", "team", "gallery", "contact"]);
    expect(tiles).toHaveLength(4);
  });

  it("produit les tuiles fournies par la configuration", () => {
    const tiles = normalizeTiles({ tuiles_json: DEFAULT_TILES_JSON });
    expect(tiles.map((tile) => tile.kind)).toEqual(["welcome", "team", "gallery", "contact"]);
    expect(tiles.map((tile) => tile.label)).toEqual([
      "Bienvenue",
      "Notre équipe",
      "Nos réalisations",
      "Contact",
    ]);
  });

  it("accepte les alias, les icônes inconnues et les tuiles désactivées", () => {
    const tiles = normalizeTiles({
      tuiles_json: JSON.stringify([
        { id: "home", type: "bienvenue", icone: "home", libelle: "Accueil" },
        { id: "faq", type: "custom", icone: "inconnue", libelle: "FAQ", titre: "Questions", texte: "Réponse" },
        { id: "off", type: "text", libelle: "Masquée", actif: false },
      ]),
    });

    expect(tiles).toHaveLength(2);
    expect(tiles[0].kind).toBe("welcome");
    expect(tiles[0].icon).toBe("home");
    expect(tiles[1].kind).toBe("text");
    expect(tiles[1].icon).toBe("comments");
    expect(tiles[1].title).toBe("Questions");
  });

  it("limite à huit tuiles et conserve une structure de repli", () => {
    const many = normalizeTiles({
      tuiles_json: JSON.stringify(
        Array.from({ length: 10 }, (_, index) => ({
          id: `tuile-${index}`,
          type: "text",
          libelle: `Tuile ${index}`,
        })),
      ),
    });
    expect(many).toHaveLength(8);

    const disabled = normalizeTiles({
      tuiles_json: JSON.stringify([{ id: "x", type: "text", libelle: "X", actif: false }]),
    });
    expect(disabled).toHaveLength(4);

    expect(normalizeTiles({ tuiles_json: "pas du json" })).toHaveLength(4);
  });

  it("déduplique les identifiants sans perdre les éléments", () => {
    const tiles = normalizeTiles({
      tuiles_json: JSON.stringify([
        { id: "same", type: "text", libelle: "A" },
        { id: "same", type: "text", libelle: "B" },
      ]),
    });
    expect(tiles.map((tile) => tile.id)).toEqual(["same", "same_2"]);
  });

  it("normalise les types et les icônes", () => {
    expect(canonicalTileKind("Galerie")).toBe("gallery");
    expect(canonicalTileKind("Réalisations")).toBe("gallery");
    expect(canonicalTileKind("inconnu")).toBe("text");
    expect(canonicalIcon("home")).toBe("home");
    expect(canonicalIcon("inconnue")).toBe("comments");
  });

  it("associe chaque tuile au bon type de panneau", () => {
    const params = {
      tuiles_json: DEFAULT_TILES_JSON,
      titre_welcome: "Bienvenue",
      titre_contact: "Contact",
    };
    const panels = createPanels(params, normalizeTiles(params));
    expect(panels.map((panel) => panel.kind)).toEqual([
      "welcome",
      "team",
      "gallery",
      "contact",
    ]);
    expect(panels[0].title).toBe("Bienvenue");
    expect(panels[0].images[0]).toBeTruthy();
    expect(panels[0].icon).toBe("home");
    expect(panels[3].title).toBe("Contact");
  });

  it("sérialise les modèles d'éléments", () => {
    const tile = new TileModel({
      id: "Salle & Café",
      type: "gallery",
      icone: "image",
      libelle: "Photos",
      description: "Galerie",
    });
    expect(tile.id).toBe("salle-caf");
    expect(tile.kind).toBe("gallery");
    expect(tile.label).toBe("Photos");
    expect(tile.get("absent", "repli")).toBe("repli");
    expect(tile.toJSON()).toMatchObject({
      id: "salle-caf",
      type: "gallery",
      icone: "image",
      libelle: "Photos",
    });

    const panel = new PanelModel({
      id: "p",
      kind: "team",
      title: "Équipe",
      text: "Texte",
      images: ["https://x.example/1.jpg", "", 42],
    });
    expect(panel.images).toEqual(["https://x.example/1.jpg"]);
    expect(panel.toJSON().images).toEqual(["https://x.example/1.jpg"]);

    const unique = uniqueElements([
      new PanelModel({ id: "a" }),
      new PanelModel({ id: "a" }),
    ]);
    expect(unique.map((element) => element.id)).toEqual(["a", "a_2"]);
    expect(new TileModel({ id: "off", actif: false }).enabled).toBe(false);
  });
});
