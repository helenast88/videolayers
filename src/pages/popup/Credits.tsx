// VideoLayer: what it's made with, and where the idea came from
const CREDITS = [
  {
    name: "EasySubs",
    by: "Nitrino and contributors · MIT",
    what: "Subtitles, the second line, translation and phrase navigation",
    url: "https://github.com/Nitrino/easysubs",
  },
  {
    name: "Chrome extension boilerplate",
    by: "Seo Jong Hak · MIT",
    what: "The extension's build setup, through EasySubs",
    url: "https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite",
  },
  {
    name: "Video.js Skins Design Challenge",
    by: "Contra, Video.js and Mux",
    what: "Where the idea of a player for every use case came from",
    url: "https://contra.com/community/topic/videojsskinschallenge",
  },
];

const Credits = ({ onBack }: { onBack: () => void }) => (
  <section className="vl-packs vl-credits" aria-labelledby="vl-credits-title">
    <div className="vl-credits-head">
      <button type="button" className="vl-edit" onClick={onBack}>
        ‹ Back
      </button>
      <span id="vl-credits-title" className="vl-packs-title">
        Credits
      </span>
    </div>
    {CREDITS.map((credit) => (
      <a key={credit.url} className="vl-pack vl-credit" href={credit.url} target="_blank" rel="noreferrer">
        <span className="vl-pack-text">
          <span className="vl-pack-name">{credit.name}</span>
          <span className="vl-pack-description">{credit.by}</span>
          <span className="vl-pack-description">{credit.what}</span>
        </span>
      </a>
    ))}
  </section>
);

export default Credits;
