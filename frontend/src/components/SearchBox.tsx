import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { suggest } from "../api";
import Icon from "./Icon";

/**
 * A search input with debounced autocomplete. The suggestion dropdown only
 * shows while the box is focused / being typed in, and closes on submit,
 * Escape, outside click, or the clear button — so it never covers results.
 *
 * Keyboard: ArrowDown / ArrowUp move a highlight through the suggestions
 * (YouTube-style), Enter submits the highlighted one (or the typed text when
 * nothing is highlighted), Escape closes the dropdown.
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
  const [active, setActive] = useState(-1);
  const debounce = useRef<number>();
  const formRef = useRef<HTMLFormElement>(null);
  const listId = useId();

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

  // Any change to the suggestion list drops the highlight — the old index no
  // longer points at the same thing.
  useEffect(() => {
    setActive(-1);
  }, [suggestions]);

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
    setActive(-1);
    onSubmit(t);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      e.currentTarget.blur();
      return;
    }

    const canNav = open && suggestions.length > 0;
    if (e.key === "ArrowDown" && canNav) {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && canNav) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0 && active < suggestions.length) {
      // Let the highlighted suggestion win over the raw input; stop the form
      // submit from also firing with the typed text.
      e.preventDefault();
      const picked = suggestions[active];
      setQ(picked);
      submit(picked);
    }
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
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          active >= 0 ? `${listId}-opt-${active}` : undefined
        }
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {q && (
        <button
          type="button"
          className="searchbar__clear"
          aria-label="Borrar búsqueda"
          onClick={() => {
            setQ("");
            setSuggestions([]);
            setActive(-1);
            setOpen(false);
          }}
        >
          <Icon name="x" size={15} />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <ul className="searchbar__suggestions" id={listId} role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : undefined}
              onMouseEnter={() => setActive(i)}
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
