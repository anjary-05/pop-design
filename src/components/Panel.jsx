import { Icon } from "../Icon.jsx";
import { Markdown } from "../core/Markdown.jsx";

function PanelMedia({ image, icon = "image", className = "", size = 48 }) {
  if (image) return <img className={`panel-img ${className}`.trim()} src={image} alt="" loading="lazy" />;
  return (
    <div className={`panel-img panel-img--placeholder ${className}`.trim()} aria-hidden="true">
      <Icon name={icon} size={size} />
    </div>
  );
}

function PanelImages({ images, className = "", icon = "image" }) {
  if (!Array.isArray(images) || images.length === 0) {
    return (
      <div className={`panel-images ${className}`.trim()}>
        <PanelMedia icon={icon} />
      </div>
    );
  }
  return (
    <div className={`panel-images ${className}`.trim()}>
      {images.map((image, index) => (
        <PanelMedia image={image} icon={icon} key={`${image}-${index}`} />
      ))}
    </div>
  );
}

function Gallery({ panel, media, canMedia, onOpenMedia, onRequestMedia }) {
  const photos = Array.isArray(media?.photos) ? media.photos : [];
  const liens = Array.isArray(media?.liens) ? media.liens : [];
  const allItems = [
    ...(Array.isArray(panel.images) ? panel.images : []).map((url, index) => ({
      id: `panel-${index}`,
      libelle: panel.title,
      url,
    })),
    ...photos,
  ];
  const items =
    typeof panel.maxItems === "number" ? allItems.slice(0, panel.maxItems) : allItems;

  if (items.length === 0 && liens.length === 0) {
    return (
      <div className="panel-empty">
        <p>Aucune réalisation n&apos;est encore chargée pour ce lien.</p>
        <button type="button" className="btn" onClick={onRequestMedia}>
          <Icon name="image" size={16} /> Charger la galerie
        </button>
        {canMedia ? null : (
          <p className="hint">La galerie doit d&apos;abord être autorisée sur ce lien.</p>
        )}
      </div>
    );
  }

  return (
    <>
      {items.length > 0 ? (
        <div className="gallery">
          {items.map((photo, index) => (
            <figure className="gallery__item" key={photo.id ?? index}>
              <button
                type="button"
                className="gallery__thumb"
                onClick={() => onOpenMedia(photo.url)}
                aria-label={`Agrandir : ${photo.libelle || panel.title}`}
              >
                <img src={photo.url} alt={photo.libelle || ""} loading="lazy" />
              </button>
              {photo.libelle ? <figcaption>{photo.libelle}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : null}
      {liens.length > 0 ? (
        <ul className="gallery__links">
          {liens.map((lien, index) => (
            <li key={lien.id ?? index}>
              <button type="button" className="link-btn" onClick={() => onOpenMedia(lien.url)}>
                <Icon name="link" size={14} /> {lien.libelle}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** Stratégies de rendu de corps de panneau par kind/layout (registre générique). */
const panelBodyRenderers = {
  welcome: ({ panel, chat, content }) => (
    <div className="panel-grid">
      <div className="panel-grid__col">
        <PanelMedia image={panel.images[0]} icon={panel.icon || "home"} />
        <Markdown text={panel.text} enabled={chat.markdown} />
      </div>
      <div className="panel-grid__col">
        <PanelMedia image={panel.images[1]} icon={panel.icon || "home"} />
        {content.brandName || content.linkLabel ? (
          <p className="panel-note">
            {content.brandName}
            {content.brandName && content.linkLabel ? " – " : ""}
            {content.linkLabel}
          </p>
        ) : null}
      </div>
    </div>
  ),
  team: ({ panel, chat }) => {
    if (Array.isArray(panel.members) && panel.members.length > 0) {
      return (
        <>
          {panel.text ? <Markdown text={panel.text} enabled={chat.markdown} /> : null}
          <div className="team-grid">
            {panel.members.map((member, index) => (
              <article className="team-card" key={`${member.name}-${index}`}>
                {member.image ? (
                  <img className="team-card__img" src={member.image} alt="" loading="lazy" />
                ) : (
                  <div className="team-card__img team-card__img--placeholder" aria-hidden="true">
                    <Icon name="users" size={28} />
                  </div>
                )}
                <div className="team-card__body">
                  <h3>{member.name || "Membre"}</h3>
                  {member.role ? <p>{member.role}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </>
      );
    }
    return (
      <div className="panel-grid panel-grid--team">
        <div className="panel-grid__col panel-grid__col--text">
          <Markdown text={panel.text} enabled={chat.markdown} />
        </div>
        <div className="panel-grid__col panel-grid__col--narrow">
          <PanelImages images={panel.images} icon={panel.icon || "users"} />
        </div>
      </div>
    );
  },
  gallery: ({ panel, media, capabilities, chat, onOpenMedia, onRequestMedia }) => {
    const canMedia = Array.isArray(capabilities) && capabilities.includes("media");
    return (
      <>
        {panel.text ? <Markdown text={panel.text} enabled={chat.markdown} /> : null}
        <Gallery panel={panel} media={media} canMedia={canMedia} onOpenMedia={onOpenMedia} onRequestMedia={onRequestMedia} />
      </>
    );
  },
  contact: ({ panel, chat, contactDraft, setContactDraft, onSend, onClose, locked }) => (
    <>
      <Markdown text={panel.text} enabled={chat.markdown} />
      <form
        className="panel-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (onSend(contactDraft)) {
            setContactDraft("");
            onClose();
          }
        }}
      >
        <label className="field">
          <span>Votre message</span>
          <textarea
            rows={5}
            value={contactDraft}
            onChange={(event) => setContactDraft(event.target.value)}
            disabled={locked}
            maxLength={chat.maxLength}
            placeholder={chat.placeholderContact}
            aria-label="Votre message"
          />
        </label>
        <button type="submit" className="btn" disabled={locked || contactDraft.trim() === ""}>
          <Icon name="send" size={16} /> Envoyer dans la discussion
        </button>
      </form>
    </>
  ),
  text: ({ panel, chat }) => (
    <>
      {Array.isArray(panel.images) && panel.images.length > 0 ? (
        <PanelImages images={panel.images} className="panel-images--hero" icon={panel.icon || "file"} />
      ) : null}
      {panel.text ? <Markdown text={panel.text} enabled={chat.markdown} /> : null}
    </>
  ),
};

function resolvePanelRenderer(panel) {
  const view = panel?.view ?? {};
  return panelBodyRenderers[view.kind ?? panel?.kind] ?? panelBodyRenderers[view.layout] ?? panelBodyRenderers[panel?.kind] ?? panelBodyRenderers.text;
}

function PanelBody(props) {
  const Renderer = resolvePanelRenderer(props.panel);
  return Renderer(props);
}

/** Fenêtre modale générique pilotée par le descripteur de vue (panel.view/kind). */
export function Panel(props) {
  const { panel, onClose, panelRef } = props;
  const titleId = `panel-title-${panel.id}`;
  return (
    <div
      className="pop-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`pop-panel pop-panel--${panel.kind}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panelRef}
      >
        <button type="button" className="pop-panel__close" onClick={onClose} aria-label="Fermer">
          <Icon name="close" size={18} />
        </button>
        <h2 className="pop-card__title" id={titleId}>
          {panel.title}
        </h2>
        <div className="pop-panel__body">
          <PanelBody {...props} />
        </div>
      </div>
    </div>
  );
}

/** Registre de renderers extensible (aligné logique gestion_station / stratégies). */
export function registerPanelBodyRenderer(kind, renderer) {
  panelBodyRenderers[kind] = renderer;
}
export { panelBodyRenderers };

