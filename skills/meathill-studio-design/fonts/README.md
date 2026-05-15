# Self-hosted fonts (currently empty)

This directory is the planned home for self-hosted webfont files (Fraunces, Nunito, JetBrains Mono — all OFL-licensed, redistribution allowed).

**Right now, all three fonts load from Google Fonts CDN.** See the `<link>` block in `README.md` for the import URL.

When the studio decides to self-host (e.g. for CN users / offline reliability), drop the `.woff2` files in here and add `@font-face` declarations to `colors_and_type.css`. Suggested filenames:

- `Fraunces-Variable.woff2`            (display)
- `Fraunces-Italic-Variable.woff2`     (display italic)
- `Nunito-Variable.woff2`              (body)
- `JetBrainsMono-Variable.woff2`       (mono)

Tell the design agent when you've added them so it can update the `@font-face` block.
