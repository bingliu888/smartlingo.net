# SmartLingo.net legacy reference

Captured: 2026-07-31

Purpose: preserve the browser-visible identity of the pre-migration SmartLingo.net deployment before DNS or hosting changes. These files are evidence and design reference only. The migrated application must not depend on them at runtime, publish them as active pages, or treat hidden source data as public content.

## Browser-visible content recorded during migration

- Brand: `SmartLingo`
- Chinese product line: `开口说，才会说`
- English social-preview line: `Speak a new language from day one.`
- Positioning: AI-native language learning through real-situation conversation with immediate, supportive correction
- Visible scenarios and capabilities: cafés, airports, interviews, pronunciation feedback, immersive reading, daily listening or radio, and structured beginner progression
- Social capabilities: Community, friend or class motivation, learning experience, and class learning
- Languages declared by the public page: Spanish, English, French, Japanese, German, Italian, and Korean (`es`, `en`, `fr`, `ja`, `de`, `it`, `ko`)
- Public metadata described the web experience as free to start; that archived metadata is not an active price, subscription, or payment authorization for the migrated site.

The legacy experience also used a green visual system and a parrot mark. The migrated site may preserve the high-level green language-learning identity, but it must use original branding and must not copy third-party character, lesson, exercise, or visual assets.

## Backup manifest

| File | Bytes | SHA-256 | Purpose |
| --- | ---: | --- | --- |
| `root-2026-07-31.html` | 18,205 | `b40afa2f89d0452178882ab0d4895666f94d3ac8077369ebd80e317cf7db3283` | Root response and browser-visible public metadata before migration |
| `welcome-2026-07-31.html` | 17,840 | `7b05adc21703806cf904c3cffca7f4f211af830b1a5dc742d3851ee3ba2ee7ab` | Welcome response and browser-visible product metadata before migration |
| `icon-192.png` | 5,322 | `e474aeba36acf602a7fea67c80834644385bbdbe253978f5b1099cd29039f1e4` | Legacy 192-pixel application icon |
| `apple-touch-icon.png` | 5,033 | `b9f229d02210a00eb25b11f213a4ce0500f789191562afe5d21cd03f8015c69e` | Legacy Apple touch icon |
| `opengraph-image.png` | 97,985 | `41f373d3c8ed4f0f9bc8c32da3cce1a5d2c652b9982d1ec346555c890fcd627b` | Legacy social-preview image |

## Integrity and use rules

- Re-run SHA-256 checks before relying on a file as migration evidence.
- Do not execute scripts from the archived HTML.
- Do not copy session data, analytics identifiers, deployment identifiers, build chunks, or hidden source content into the new product.
- Do not expose these archived HTML files through public application routes.
- New SmartLingo course text, exercises, AI prompts, class assets, and social-preview art must be original or properly licensed.
