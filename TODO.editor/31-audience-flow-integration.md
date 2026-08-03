# 31 — The audience-flow integration (Primmel + OIML SMART)

**Wave:** docs · **Depends on:** 30 · **Priority:** P1

## Goal

The Studio is findable and usable from every audience's own door:
the Primmel product site (the language audience), the OIML SMART
site (the metrology audience), and the federation volumes — each
audience meets the Studio in their own terms, then lands in the
user guide (30) for depth.

## Spec

- **primmel.github.io** (the Primmel product site,
  `~/src/primmel/primmel.github.io`):
  - `src/content/docs/studio.mdx` — the Studio page: what it is (the
    authoring tool for Primmel models), the feature map per surface,
    the run/gates, the plugin doctrine (base layer + programs), and
    the link into the user guide.
  - The audiences pages mention the tool honestly: publishers
    (author + validate + doc-map), implementers (implementation
    models + coverage), auditors (diff + comments + save preview).
  - Check the nav pattern first (consts.ts / a sidebar config) and
    add the entry the house way.
- **oimlsmart.github.io** (the OIML SMART site,
  `~/src/oimlsmart/oimlsmart.github.io`):
  - `src/content/docs/guides/primmel-studio.mdx` — the SMART
    audience's page: author a Recommendation with the Studio (the
    R 7 story), the OIML program layer, the certificate preview, the
    link to the learn volume's Tier 5 + the user guide.
  - Check the guides' index pattern and slot it in.
- **The editor README** — the doc map section: user guide (docs/),
  the public pages, the architecture chapter, the learn tier.
- **The smart repo architecture chapter** (21) gains the guide link
  row if the house style wants it (check the "Read next" block).

## Homes

1. primmel.github.io: the docs page + audience mentions + nav.
2. oimlsmart.github.io: the guides page + index slot.
3. This repo's README doc map.

## Acceptance

- Both sites build clean (their own build commands), the new pages
  render, and the links resolve (their link checkers where they
  pass at baseline).
- The editor README's doc map is complete (guide → sites →
  federation).
- Gates green.
