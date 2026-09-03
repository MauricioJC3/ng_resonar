import { useEffect, useRef, useState } from "react";

import { suggest } from "../api";
import Icon from "./Icon";

/**
 * A search input with debounced autocomplete. The suggestion dropdown only
 * shows while the box is focused / being typed in, and closes on submit,
 * Escape, outside click, or the clear button — so it never covers results.
 */
export default function SearchBox({
  placeholder,
  onSubmit,
  autoFocus,
}: {
  placeholder: string;
  onSubmit: (term: string) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<number>();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!open || !term) {
      setSuggestions([]);
      return;
    }
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      setSuggestions(await suggest(term));
    }, 180);
    return () => window.clearTimeout(debounce.current);
  }, [q, open]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function submit(term: string) {
    const t = term.trim();
    if (!t) return;
    setOpen(false);
    setSuggestions([]);
    onSubmit(t);
  }

  return (
    <form
      ref={formRef}
      className="searchbar"
      onSubmit={(e) => {
        e.preventDefault();
        submit(q);
      }}
    >
      <span className="searchbar__icon">
        <Icon name="search" size={18} />
      </span>
      <input
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            e.currentTarget.blur();
          }
        }}
      />
      {q && (
        <button
          type="button"
          className="searchbar__clear"
          aria-label="Borrar búsqueda"
          onClick={() => {
            setQ("");
            setSuggestions([]);
            setOpen(false);
          }}
        >
          <Icon name="x" size={15} />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <ul className="searchbar__suggestions">
          {suggestions.map((s) => (
            <li
              key={s}
              onMouseDown={() => {
                setQ(s);
                submit(s);
              }}
            >
              <Icon name="search" size={13} /> {s}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
