"""Generate the web's translation dictionary from the mobile app's ARB files.

The app's Hindi and Gujarati strings are already written and in use, so the
website reuses them rather than inventing a second, subtly different wording
for the same concepts. A shopkeeper who switches between the phone and the
laptop should read the same words.

Run from the repo root:
    python scripts/arb_to_ts.py

Output: apps/admin_web/src/lib/i18n/messages.generated.ts
"""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
ARB_DIR = ROOT / "apps" / "mobile_flutter" / "lib" / "l10n"
OUT = ROOT / "apps" / "admin_web" / "src" / "lib" / "i18n" / "messages.generated.ts"

LOCALES = {"en": "app_en.arb", "hi": "app_hi.arb", "gu": "app_gu.arb"}


def load(name: str) -> dict[str, str]:
    raw = json.loads((ARB_DIR / name).read_text(encoding="utf-8"))
    # Keys beginning with @ are ARB metadata, not strings.
    return {k: v for k, v in raw.items() if not k.startswith("@") and isinstance(v, str)}


def main() -> None:
    tables = {code: load(filename) for code, filename in LOCALES.items()}
    english = tables["en"]

    lines = [
        "// GENERATED FILE — do not edit by hand.",
        "//",
        "// Source: apps/mobile_flutter/lib/l10n/*.arb",
        "// Regenerate: python scripts/arb_to_ts.py",
        "//",
        "// The app's translations are reused verbatim so the same concept reads the",
        "// same way on the phone and on the website.",
        "",
        "export const MESSAGES = {",
    ]

    for code in LOCALES:
        table = tables[code]
        lines.append(f"  {code}: {{")
        for key in english:
            # Fall back to English for anything a locale has not translated, so
            # a missing string shows real words rather than a key name.
            value = table.get(key) or english[key]
            escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
            lines.append(f'    "{key}": "{escaped}",')
        lines.append("  },")

    lines += [
        "} as const;",
        "",
        "export type Locale = keyof typeof MESSAGES;",
        "export type MessageKey = keyof (typeof MESSAGES)[\"en\"];",
        "",
    ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8")

    missing = {
        code: sum(1 for k in english if not tables[code].get(k))
        for code in LOCALES
        if code != "en"
    }
    print(f"wrote {OUT.relative_to(ROOT)} — {len(english)} keys")
    for code, count in missing.items():
        if count:
            print(f"  {code}: {count} key(s) fall back to English")


if __name__ == "__main__":
    main()
