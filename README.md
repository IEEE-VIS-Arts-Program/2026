# VISAP 2026

Website for the **IEEE VIS Arts Program 2026**, themed *Amplification*.

Held November 9–13, 2026 in Boston, Massachusetts, as part of [IEEE VIS 2026](https://ieeevis.org).

## About

VISAP is a dedicated venue for visualization researchers, designers, and artists exploring innovative approaches at the intersection of visualization and the arts. This year's theme, *Amplification*, invites contributions that explore how visualization can amplify voices, perspectives, and domains.

## Site Structure

A single-page static site (`index.html`) with the following sections:

- **Hero** — title, event date and location, animated colour-shifting blobs
- **Theme intro** — description of the *Amplification* theme
- **About VISAP** — programme overview
- **Call for Submissions** — three tracks with page limits and deadlines
- **Organisers** — programme chairs and design chair
- **Contact** — email

## Interactive Features

### Proximity audio
The hero section contains five animated SVG blobs (teal, orange, lavender, yellow, pink). Moving the cursor or finger near a blob triggers its associated ambient sound, which fades in based on distance. Only the nearest blob group plays at a time.

| Blob colour | Sound |
|---|---|
| Teal | Bird chorus (synthesised) |
| Orange | Tech beeps / droid chirps (synthesised) |
| Lavender | Crowd chat (`people_chatting.m4a`) |
| Yellow | Indoor chatter murmur (synthesised) |
| Pink | Silent |

Audio is initialised on first user interaction (click on desktop, touchstart on mobile) to comply with browser autoplay policy. The **Turn sound on / Switch sound off** button in the nav controls mute state.

### Title colour
The hero `h1` colour shifts toward the nearest blob colour as the cursor moves.

### Nav scroll fade
The navigation bar background fades in once the user scrolls past the hero section.

## Submission Tracks

| Track | Format | Limit |
|---|---|---|
| Paper | IEEE Conference format | 10 pages |
| Pictorial | VISAP Pictorial format | 16 pages |
| Artwork | Free-form proposal | 2 pages |

All submissions via the IEEE VGTC Electronic Conference System (PCS). Single-blind review. All deadlines at 11:59 pm AoE.

| Milestone | Date |
|---|---|
| Call Opens | May 2026 |
| Submission Deadline | TBD — June 2026 |
| Notifications | TBD — July 2026 |
| Camera Ready | TBD — August 2026 |

## Organisers

**Programme Chairs**
- [Dario Rodighiero](https://dariorodighiero.com) — University of Groningen
- [Sarah Williams](https://civicdatadesignlab.mit.edu/Sarah-Williams) — MIT
- [Weidi Zhang](https://www.zhangweidi.com) — Arizona State University

**Design Chair**
- [Ginevra Terenghi](https://www.supsi.ch/ginevra-terenghi) — SUPSI University

## Files

| File | Purpose |
|---|---|
| `index.html` | Full site — markup, CSS, and inline scripts |
| `audio_logic_v2.js` | Proximity audio engine and title colour animation |
| `people_chatting.m4a` | Ambient crowd audio (lavender blob) |
| `Vector-arancio.svg` | Orange blob SVG |
| `Vector-giallo.svg` | Yellow blob SVG |
| `Vector-lavanda.svg` | Lavender blob SVG |

## Contact

[art@ieeevis.org](mailto:art@ieeevis.org)
