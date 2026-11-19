// Schéma et accès aux paramètres (OOP) : définition centralisée, lecture et parsing.
// Les définitions restent la source unique pour le manifeste et le rendu,
// mais sont encapsulées dans un schéma paramétrable.

import { Registry } from "./registry.js";

export const MAX_MESSAGE = 4000;

const OPTIONS = {
  ambiance: [
    { value: "pop", label: "Original (photo + cartes sombres)" },
    { value: "nuit", label: "Nuit profonde" },
    { value: "clair", label: "Clair / papier" },
    { value: "sable", label: "Sable chaleureux" },
    { value: "ocean", label: "Océan" },
  ],
  densite: [
    { value: "confort", label: "Confort" },
    { value: "compact", label: "Compact" },
    { value: "large", label: "Large" },
  ],
  typographie: [
    { value: "pop", label: "Originale (sans-serif)" },
    { value: "editorial", label: "Éditorial (serif)" },
    { value: "technique", label: "Technique (monospace)" },
  ],
  arrondi: [
    { value: "droit", label: "Droit" },
    { value: "doux", label: "Doux" },
    { value: "arrondi", label: "Arrondi" },
  ],
};

const SECTION_DEFAULTS = {
  render: { type: "card", layout: "stack", source: "static", media_type: "photo", max_items: 5 },
  content: { title: "", description: "", text: "", images: [], links: [] },
};

const SECTION_ITEM_SCHEMA = {
  type: "object",
  default: {
    id: "section",
    role: "custom",
    enabled: true,
    navigation: { label: "Section", icon: "file" },
    render: { ...SECTION_DEFAULTS.render },
    content: { ...SECTION_DEFAULTS.content },
  },
  properties: [
    { key: "id", label: "Identifiant", description: "Clé technique unique.", type: "string", default: "section", maxLength: 40 },
    { key: "role", label: "Rôle", description: "Rôle métier libre : welcome, team, catalogue, contact, faq…", type: "string", default: "custom", maxLength: 40 },
    { key: "enabled", label: "Activer la section", description: "Désactiver pour masquer l'onglet.", type: "boolean", default: true },
    {
      key: "navigation",
      label: "Navigation",
      description: "Onglet affiché à gauche.",
      type: "object",
      default: { label: "Section", icon: "file" },
      properties: [
        { key: "label", label: "Libellé de l'onglet", description: "Texte visible.", type: "string", default: "Section", maxLength: 40 },
        { key: "icon", label: "Icône", description: "Nom d'icône du registre.", type: "string", default: "file", maxLength: 40 },
      ],
    },
    {
      key: "render",
      label: "Rendu",
      description: "Type structurel, mise en page et source de données.",
      type: "object",
      default: { ...SECTION_DEFAULTS.render },
      properties: [
        { key: "type", label: "Type", description: "Mode d'affichage structurel.", type: "select", default: "card", options: [
          { value: "card", label: "Carte" },
          { value: "text", label: "Texte" },
          { value: "image", label: "Image" },
          { value: "grid", label: "Grille" },
          { value: "form", label: "Formulaire" },
        ] },
        { key: "layout", label: "Mise en page", description: "Variante du type.", type: "select", default: "stack", options: [
          { value: "hero", label: "Hero (2 visuels)" },
          { value: "split", label: "Texte + visuels" },
          { value: "members", label: "Cartes membres" },
          { value: "stack", label: "Empilé" },
          { value: "media", label: "Média" },
        ] },
        { key: "source", label: "Source", description: "Origine des données.", type: "select", default: "static", options: [
          { value: "static", label: "Contenu statique" },
          { value: "medias", label: "Photothèque" },
          { value: "contact", label: "Formulaire de contact" },
        ] },
        { key: "media_type", label: "Type de média", description: "Filtrer la photothèque.", type: "select", default: "photo", options: [
          { value: "photo", label: "Photos" },
          { value: "lien", label: "Liens" },
        ] },
        { key: "max_items", label: "Nombre max", description: "Nombre maximum d'images affichées (1..8).", type: "number", default: 5, min: 1, max: 8 },
      ],
    },
    {
      key: "content",
      label: "Contenu",
      description: "Données affichées dans le panneau.",
      type: "object",
      default: { ...SECTION_DEFAULTS.content },
      properties: [
        { key: "title", label: "Titre", description: "Titre du panneau.", type: "string", default: "", maxLength: 80 },
        { key: "description", label: "Description", description: "Résumé court.", type: "text", default: "", maxLength: 400 },
        { key: "text", label: "Texte", description: "Contenu long (Markdown).", type: "text", default: "", maxLength: 1200 },
        { key: "images", label: "Images", description: "URLs ou chemins d'images fixes.", type: "array", default: [], maxItems: 8, items: { type: "string", default: "", maxLength: 500 } },
        { key: "members", label: "Membres", description: "Cartes membres : nom, rôle et photo.", type: "array", default: [], maxItems: 8, items: {
          type: "object",
          default: { name: "John Doe", role: "Fonction", image: "" },
          properties: [
            { key: "name", label: "Nom", description: "Nom affiché.", type: "string", default: "John Doe", maxLength: 80 },
            { key: "role", label: "Rôle", description: "Fonction ou description.", type: "string", default: "", maxLength: 120 },
            { key: "image", label: "Photo", description: "URL de la photo.", type: "image", default: "" },
          ],
        } },
        { key: "links", label: "Liens", description: "URLs de liens complémentaires.", type: "array", default: [], maxItems: 8, items: { type: "string", default: "", maxLength: 500 } },
      ],
    },
  ],
};

export const PARAM_DEFINITIONS = [
  { key: "titre", label: "Titre", description: "Titre de l'en-tête (fourni par le backend/configuration).", type: "string", default: "", maxLength: 60 },
  { key: "nom_assistant", label: "Nom de l'assistant", description: "Nom affiché dans le chat ; vide = nom de l'organisation.", type: "string", default: "", maxLength: 60 },
  { key: "sous_titre", label: "Sous-titre", description: "Phrase d'accueil sous le titre ; {marque} et {lien} remplacés.", type: "text", default: "", maxLength: 300 },
  { key: "logo_url", label: "Logo", description: "Image du logo (backend/marque).", type: "image", default: "" },
  { key: "image_fond", label: "Image de fond", description: "Photo plein écran (backend).", type: "image", default: "" },
  { key: "image_soulignement", label: "Soulignement du titre", description: "Trait décoratif (backend).", type: "image", default: "" },
  { key: "image_welcome_1", label: "Visuel « Bienvenue » 1", description: "Image panneau (backend).", type: "image", default: "" },
  { key: "image_welcome_2", label: "Visuel « Bienvenue » 2", description: "Image panneau (backend).", type: "image", default: "" },
  { key: "image_equipe", label: "Portrait d'équipe", description: "Photo panneau équipe (backend).", type: "image", default: "" },
  { key: "avatar_assistant_url", label: "Avatar de l'assistant", description: "Avatar assistant (backend).", type: "image", default: "" },
  { key: "avatar_utilisateur_url", label: "Avatar du visiteur", description: "Avatar visiteur (backend).", type: "image", default: "" },
  { key: "couleur_accent", label: "Couleur d'accent", description: "Accent UI (backend/thème).", type: "color", default: "#006599" },
  { key: "couleur_principale", label: "Couleur des cartes", description: "Fond des cartes (backend/thème).", type: "color", default: "#2c2a35" },
  { key: "couleur_texte", label: "Couleur du texte", description: "Texte principal (backend/thème).", type: "color", default: "#ffffff" },
  { key: "ambiance", label: "Ambiance", description: "Palette générale.", type: "select", default: "pop", options: OPTIONS.ambiance },
  { key: "densite", label: "Densité", description: "Espacement et taille.", type: "select", default: "confort", options: OPTIONS.densite },
  { key: "typographie", label: "Typographie", description: "Famille de police.", type: "select", default: "pop", options: OPTIONS.typographie },
  { key: "arrondi", label: "Arrondi", description: "Angle des éléments.", type: "select", default: "arrondi", options: OPTIONS.arrondi },
  { key: "titre_welcome", label: "Titre « Bienvenue »", description: "Titre panneau (backend).", type: "string", default: "Bienvenue", maxLength: 60 },
  { key: "texte_welcome", label: "Texte « Bienvenue »", description: "Contenu panneau (backend).", type: "text", default: "", maxLength: 1200 },
  { key: "titre_equipe", label: "Titre « Équipe »", description: "Titre panneau (backend).", type: "string", default: "Équipe", maxLength: 60 },
  { key: "texte_equipe", label: "Texte « Équipe »", description: "Contenu panneau (backend).", type: "text", default: "", maxLength: 1200 },
  { key: "titre_realisations", label: "Titre « Réalisations »", description: "Titre panneau (backend).", type: "string", default: "Réalisations", maxLength: 60 },
  { key: "titre_contact", label: "Titre « Contact »", description: "Titre panneau (backend).", type: "string", default: "Contact", maxLength: 60 },
  { key: "texte_contact", label: "Texte « Contact »", description: "Texte panneau (backend).", type: "text", default: "", maxLength: 600 },
  { key: "titre_identite", label: "Titre du formulaire", description: "Titre formulaire (backend).", type: "string", default: "", maxLength: 80 },
  { key: "texte_identite", label: "Texte du formulaire", description: "Texte formulaire (backend).", type: "text", default: "", maxLength: 400 },
  { key: "placeholder_message", label: "Placeholder du message", description: "Aide saisie (backend).", type: "string", default: "", maxLength: 120 },
  { key: "placeholder_contact", label: "Placeholder du panneau Contact", description: "Aide saisie (backend).", type: "string", default: "", maxLength: 120 },
  { key: "label_envoyer", label: "Libellé du bouton Envoyer", description: "Libellé (backend).", type: "string", default: "Envoyer", maxLength: 40 },
  { key: "label_terminer", label: "Libellé du bouton Terminer", description: "Libellé (backend).", type: "string", default: "Terminer", maxLength: 40 },
  { key: "message_vide", label: "Message de fil vide", description: "Texte fil vide (backend).", type: "text", default: "", maxLength: 300 },
  { key: "texte_bienvenue", label: "Accueil de la discussion", description: "Accueil (backend).", type: "text", default: "", maxLength: 600 },
  { key: "suggestions", label: "Suggestions de départ", description: "Suggestions (backend), une par ligne.", type: "text", default: "", maxLength: 1200 },
  { key: "entree_envoyer", label: "Entrée envoie le message", description: "Comportement d'envoi.", type: "boolean", default: true },
  { key: "texte_footer", label: "Texte du pied de page", description: "Pied de page (backend).", type: "string", default: "", maxLength: 200 },
  { key: "lien_footer", label: "Lien du pied de page", description: "Lien pied de page (backend).", type: "url", default: "https://onirtech.com" },
  { key: "afficher_credit", label: "Afficher le crédit", description: "Afficher le crédit.", type: "boolean", default: false },
  { key: "design_json", label: "Design avancé (JSON)", description: "Tokens/éléments visuels (backend).", type: "text", default: "{}", maxLength: 2000 },
  { key: "tuiles_json", label: "Tuiles & panneaux (JSON)", description: "Configuration des tuiles/panneaux (backend).", type: "text", default: JSON.stringify([
    { id: "welcome", type: "welcome", icone: "home", libelle: "Bienvenue", description: "" },
    { id: "equipe", type: "team", icone: "users", libelle: "Équipe", description: "" },
    { id: "realisations", type: "gallery", icone: "handshake", libelle: "Réalisations", description: "" },
    { id: "contact", type: "contact", icone: "comments", libelle: "Contact", description: "" },
  ], null, 0), maxLength: 2000 },
  { key: "sections", label: "Sections structurées", description: "Organisation recommandée : rôle, rendu et contenu séparés. Prioritaire sur tuiles_json.", type: "array", default: [], minItems: 0, maxItems: 8, items: SECTION_ITEM_SCHEMA },
  { key: "chat_json", label: "Discussion avancée (JSON)", description: "Options de discussion (backend).", type: "text", default: "{}", maxLength: 2000 },
];

export class ParamSchema {
  constructor(definitions = PARAM_DEFINITIONS) {
    this.definitions = definitions;
    this.byKey = new Registry("params", definitions.map((p) => [p.key, p]));
    this.defaults = Object.freeze(Object.fromEntries(definitions.map((p) => [p.key, p.default])));
  }

  getDefinition(key) { return this.byKey.get(key); }
  getDefault(key) { return this.defaults[key]; }

  paramValue(params, key) {
    const value = params?.[key];
    if (value === undefined || value === null) return this.defaults[key];
    if (typeof value === "string") return value.trim() === "" ? this.defaults[key] : value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return this.defaults[key];
  }

  textParam(params, key) {
    const value = this.paramValue(params, key);
    return typeof value === "string" ? value : String(this.defaults[key] ?? "");
  }

  boolParam(params, key) {
    const value = params?.[key];
    if (typeof value === "boolean") return value;
    if (value === "1" || value === "true") return true;
    if (value === "0" || value === "false") return false;
    return Boolean(this.defaults[key]);
  }

  isCustomized(params, key) {
    const value = params?.[key];
    return value !== undefined && value !== null && value !== this.defaults[key] && value !== "";
  }

  parseJsonParam(params, key, fallback) {
    const raw = params?.[key];
    const source = typeof raw === "string" && raw.trim() !== "" ? raw : this.defaults[key];
    if (typeof source !== "string" || source.trim() === "") return fallback;
    try {
      const value = JSON.parse(source);
      if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
      if (fallback !== null && typeof fallback === "object") {
        return value !== null && typeof value === "object" && !Array.isArray(value) ? value : fallback;
      }
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }
}

export const paramSchema = new ParamSchema(PARAM_DEFINITIONS);
export const DEFAULTS = paramSchema.defaults;

export function paramValue(params, key) { return paramSchema.paramValue(params, key); }
export function textParam(params, key) { return paramSchema.textParam(params, key); }
export function boolParam(params, key) { return paramSchema.boolParam(params, key); }
export function isCustomized(params, key) { return paramSchema.isCustomized(params, key); }
export function parseJsonParam(params, key, fallback) { return paramSchema.parseJsonParam(params, key, fallback); }
