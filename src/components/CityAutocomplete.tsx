"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { matchCities, findCity, citiesByName } from "@/lib/cities";

interface CityAutocompleteProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSelectCity: (cityName: string) => void;
  onBlur?: () => void;
}

export function CityAutocomplete({
  id,
  label,
  value,
  placeholder,
  onChange,
  onSelectCity,
  onBlur,
}: CityAutocompleteProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [items, setItems] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function updateSuggestions(text: string) {
    const city = findCity(text);
    const exactLabel = `${city?.name ?? ""}, ${city?.country ?? ""}` === text;
    const matches = matchCities(text, 8);
    setItems(matches);
    setActive(-1);
    setOpen(matches.length > 0 && !(exactLabel && matches.length <= 1));
  }

  function pick(name: string) {
    const city = citiesByName[name];
    if (!city) return;
    onChange(`${city.name}, ${city.country}`);
    onSelectCity(name);
    setOpen(false);
    setActive(-1);
  }

  function handleInput(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    updateSuggestions(e.target.value);
  }

  function handleFocus() {
    if (value.trim()) updateSuggestions(value);
  }

  function handleBlur() {
    // Delay so clicks on suggestions are handled first.
    setTimeout(() => {
      if (!wrapperRef.current?.contains(document.activeElement)) {
        setOpen(false);
        onBlur?.();
      }
    }, 150);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((prev) => Math.min(items.length - 1, prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((prev) => Math.max(0, prev - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (active >= 0) {
      const el = document.getElementById(`${listId}-${active}`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [active, listId]);

  return (
    <div className="field" ref={wrapperRef}>
      <label htmlFor={id}>{label}</label>
      <div className="combo">
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          placeholder={placeholder}
          value={value}
          onChange={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        />
        <ul
          id={listId}
          className="suggest"
          role="listbox"
          aria-label="Cities"
          hidden={!open}
        >
          {items.length === 0 ? (
            <li className="empty">No match yet. Try a nearby big city.</li>
          ) : (
            items.map((name, idx) => {
              const city = citiesByName[name];
              return (
                <li
                  key={name}
                  id={`${listId}-${idx}`}
                  role="option"
                  aria-selected={idx === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(name);
                    inputRef.current?.focus();
                  }}
                >
                  {name}, <span>{city?.country}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
