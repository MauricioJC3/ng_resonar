import type { VideoItem } from "../types";
import Icon from "./Icon";

function formatViews(n?: number | null): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M vistas`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil vistas`;
  return `${n} vistas`;
}

export default function VideoCard({
  video,
  onClick,
}: {
  video: VideoItem;
  onClick: () => void;
}) {
  const views = formatViews(video.views);
  return (
    <button className="vcard" onClick={onClick}>
      <span className="vcard__thumb">
        <img src={video.thumbnail} alt="" loading="lazy" />
        {video.duration && <span className="vcard__dur">{video.duration}</span>}
        <span className="vcard__play">
          <Icon name="play" size={20} filled />
        </span>
      </span>
      <span className="vcard__title">{video.title}</span>
      <span className="vcard__meta">
        {video.uploader}
        {video.uploader && views ? " · " : ""}
        {views}
      </span>
    </button>
  );
}
