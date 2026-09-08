import type { SyntheticEvent } from "react";

import { goToArtist } from "../state/appNav";

/**
 * Renders a list of artist names where each name is clickable and jumps to that
 * artist's page. Meant to sit inside a larger click target (a play button, the
 * player meta) — it stops propagation so clicking the name doesn't also trigger
 * the row.
 */
export default function ArtistLinks({ artists }: { artists: string[] }) {
  if (!artists.length) return null;

  const open = (name: string) => (e: SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    void goToArtist(name);
  };

  return (
    <>
      {artists.map((name, i) => (
        <span key={name + i}>
          {i > 0 && ", "}
          <span
            className="artistlink"
            role="link"
            tabIndex={0}
            onClick={open(name)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") open(name)(e);
            }}
          >
            {name}
          </span>
        </span>
      ))}
    </>
  );
}
