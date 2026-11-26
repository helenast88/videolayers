import { useEffect, useState } from "react";
import { FEATURES, isBuiltInPack, isFeatureOn, type TFeatureKey, type TPack } from "@src/videolayer/packs";
import { deleteCustomPack, readAllPacks, saveCustomPack } from "@src/videolayer/customPacks";
import { readSitePack, siteOf, writeSitePacks } from "@src/videolayer/sitePacks";

// VideoLayers: the packs for the site of the current tab, several at once, and the editor of the user's own packs.
// Ticking a pack saves it for the site; the page applies the packs at once (src/videolayer/init.ts) and on every later
// visit.

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
  deleteLabel = "Delete",
  onCancel,
}: {
  draft: TDraft;
  onSave: (draft: TDraft) => void;
  onDelete?: () => void;
  deleteLabel?: string;
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
            {deleteLabel}
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
  // The packs on for this site; several can be on at once
  const [picked, setPicked] = useState<string[]>([]);
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

  const save = async (ids: string[]) => {
    setPicked(ids);
    if (site) await writeSitePacks(site, ids);
  };
  // "No pack" takes them all away; a pack turns on or off on its own
  const toggle = (packId: string | null) =>
    save(packId === null ? [] : picked.includes(packId) ? picked.filter((id) => id !== packId) : [...picked, packId]);

  if (draft) {
    // A built-in pack can be changed and then reset to how it ships; the user's own packs can be deleted
    const builtIn = isBuiltInPack(draft.id);
    const edited = builtIn && packs.some((pack) => pack.id === draft.id && pack.edited);
    return (
      <PackEditor
        draft={draft}
        onCancel={() => setDraft(null)}
        onSave={async (next) => {
          const pack = await saveCustomPack(next);
          await load();
          setDraft(null);
          // A new pack is made for the site it's made on
          if (!next.id) await save([...picked, pack.id]);
        }}
        deleteLabel={builtIn ? "Reset" : "Delete"}
        onDelete={
          draft.id && (!builtIn || edited)
            ? async () => {
                await deleteCustomPack(draft.id!);
                if (!builtIn) await save(picked.filter((id) => id !== draft.id));
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
            Packs for <span>{site}</span>
          </>
        ) : (
          "Packs"
        )}
      </div>
      <div role="group" aria-labelledby="vl-packs-title">
        {options.map((option) => {
          const checked = option.id === null ? picked.length === 0 : picked.includes(option.id);
          return (
            <div key={option.id ?? "none"} className="vl-pack-row">
              <button
                type="button"
                role={option.id === null ? "radio" : "checkbox"}
                aria-checked={checked}
                className="vl-pack"
                disabled={!site}
                onClick={() => toggle(option.id)}
              >
                <span className={`vl-pack-dot c-${option.color ?? "gray"}`} aria-hidden="true">
                  {checked && <Tick />}
                </span>
                <span className="vl-pack-text">
                  <span className="vl-pack-name">{option.name}</span>
                  <span className="vl-pack-description">{option.description}</span>
                </span>
              </button>
              {"settings" in option && (
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
