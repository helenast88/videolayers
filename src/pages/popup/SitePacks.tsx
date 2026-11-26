import { useEffect, useState } from "react";
import { FEATURES, isFeatureOn, type TFeatureKey, type TPack } from "@src/videolayer/packs";
import { deleteCustomPack, readAllPacks, saveCustomPack } from "@src/videolayer/customPacks";
import { readSitePack, siteOf, writeSitePack } from "@src/videolayer/sitePacks";

// VideoLayer: the pack for the site of the current tab, and the editor of the user's own packs. Picking a pack saves
// it for the site; the page applies it at once (src/videolayer/init.ts) and on every later visit.

type TDraft = { id?: string; name: string; features: TFeatureKey[] };

const Tick = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const PackEditor = ({
  draft,
  onSave,
  onDelete,
  onCancel,
}: {
  draft: TDraft;
  onSave: (draft: TDraft) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(draft.name);
  const [features, setFeatures] = useState<TFeatureKey[]>(draft.features);
  const toggle = (key: TFeatureKey) =>
    setFeatures((on) => (on.includes(key) ? on.filter((one) => one !== key) : [...on, key]));

  return (
    <form
      className="vl-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ id: draft.id, name, features });
      }}
    >
      <div className="vl-packs-title">{draft.id ? "Edit pack" : "New pack"}</div>
      <label className="vl-field">
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="My pack" autoFocus />
      </label>
      <fieldset className="vl-features">
        <legend>Features</legend>
        {FEATURES.map((feature) => (
          <label key={feature.key} className="vl-feature">
            <input type="checkbox" checked={features.includes(feature.key)} onChange={() => toggle(feature.key)} />
            <span className="vl-pack-text">
              <span className="vl-pack-name">{feature.name}</span>
              <span className="vl-pack-description">{feature.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="vl-actions">
        {onDelete && (
          <button type="button" className="vl-button vl-button-danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <span className="vl-spacer" />
        <button type="button" className="vl-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="vl-button vl-button-primary">
          Save
        </button>
      </div>
    </form>
  );
};

const SitePacks = () => {
  const [site, setSite] = useState<string | null>(null);
  const [packs, setPacks] = useState<TPack[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [draft, setDraft] = useState<TDraft | null>(null);

  const load = async () => setPacks(await readAllPacks());

  useEffect(() => {
    load();
    chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(async ([tab]) => {
      const host = siteOf(tab?.url);
      setSite(host);
      if (host) setPicked(await readSitePack(host));
    });
  }, []);

  const pick = async (packId: string | null) => {
    setPicked(packId);
    if (site) await writeSitePack(site, packId);
  };

  if (draft) {
    return (
      <PackEditor
        draft={draft}
        onCancel={() => setDraft(null)}
        onSave={async (next) => {
          const pack = await saveCustomPack(next);
          await load();
          setDraft(null);
          // A new pack is made for the site it's made on
          if (!next.id) await pick(pack.id);
        }}
        onDelete={
          draft.id
            ? async () => {
                await deleteCustomPack(draft.id!);
                if (picked === draft.id) await pick(null);
                await load();
                setDraft(null);
              }
            : undefined
        }
      />
    );
  }

  const options: (TPack | { id: null; name: string; description: string; custom?: false; color?: undefined })[] = [
    { id: null, name: "No pack", description: "Your settings as you left them" },
    ...packs,
  ];

  return (
    <section className="vl-packs" aria-labelledby="vl-packs-title">
      <div id="vl-packs-title" className="vl-packs-title">
        {site ? (
          <>
            Pack for <span>{site}</span>
          </>
        ) : (
          "Packs"
        )}
      </div>
      <div role="radiogroup" aria-labelledby="vl-packs-title">
        {options.map((option) => {
          const checked = picked === option.id;
          return (
            <div key={option.id ?? "none"} className="vl-pack-row">
              <button
                type="button"
                role="radio"
                aria-checked={checked}
                className="vl-pack"
                disabled={!site}
                onClick={() => pick(option.id)}
              >
                <span className={`vl-pack-dot c-${option.color ?? "gray"}`} aria-hidden="true">
                  {checked && <Tick />}
                </span>
                <span className="vl-pack-text">
                  <span className="vl-pack-name">{option.name}</span>
                  <span className="vl-pack-description">{option.description}</span>
                </span>
              </button>
              {option.custom && (
                <button
                  type="button"
                  className="vl-edit"
                  aria-label={`Edit ${option.name}`}
                  onClick={() =>
                    setDraft({
                      id: option.id,
                      name: option.name,
                      features: FEATURES.filter(({ key }) => isFeatureOn(option.settings, key)).map(({ key }) => key),
                    })
                  }
                >
                  Edit
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="vl-pack vl-new" onClick={() => setDraft({ name: "", features: [] })}>
        <span className="vl-pack-dot" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M12 6v12M6 12h12" />
          </svg>
        </span>
        <span className="vl-pack-name">New pack…</span>
      </button>
    </section>
  );
};

export default SitePacks;
