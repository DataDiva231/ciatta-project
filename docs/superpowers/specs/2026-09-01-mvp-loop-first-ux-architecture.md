# Ciatta MVP loop first UX architecture

**Date:** 2026-09-01  
**Status:** Design, not implemented  
**Inputs:** Intelligence loop, study value hierarchy, Expert Council ontology, Clinical / Health Informatics lens  
**Non inputs:** Legacy screens, tab names, `understandings` as a product object

## Product

Ciatta is one Finding Composition that walks:

**Observe → Change → Pattern → Context → Action → Observe Again**

as far as this person's evidence allows, then stops. Quiet is a completed cycle.

Value order: See Change, Notice Meaningful Patterns, Get Context, Take a Bounded Next Step, Observe Again.

Onboarding is cycle 1 of the same loop (survey plus live Now preview). It is not a form that precedes the product.

## Finding Composition

1. Change, or stop (Building or Quiet)
2. Pattern only if repetition is supported
3. Context: connection, evidence, limit
4. Action only if the existing guidance gate allows
5. Observe Again: add, wait, or return

Do not backfill a weaker insight when a stage is unsupported.

## Destinations (jobs, not inherited tabs)

| Job | Role |
|---|---|
| Now | The loop at the current time. First landing after cycle 1. |
| Picture | Currently supported relationships. Same composition on tap. |
| Over time | The loop across dates. A modality, not an event log. |
| Add | New Observe. Composer on Now, not a peer tab. |
| Account | Identity, sources, privacy, export, sign out. |

Recommended standing chrome: Now, Picture, Account. Add on Now. Over time from Now and Picture.

Discard as experience law: Understanding, Discoveries / Unwritten, Today / Core / You as IA, five equal tabs, anatomy dashboard as the picture, guest gauntlet then blank home.

## Cycle 1

Welcome → Account (durable n of 1) → Observe questions with live Now preview → optional sources after policy gate → land on Now in Building, Quiet, or Surfaced.

## Implementation inventory (does not set IA)

Reuse live engine behavior: observations, personal sleep comparison, cycle associated with mood, enumerated guidance only when strong / very strong, silence, RLS. Project rows into Change / Pattern / Context / Action. Do not rename tables to clean UI copy. Do not invent thresholds, crisis detection, or causal claims.

## Open product decisions

1. Standing chrome: Now + Picture + Account vs Now + Account with Picture from Context
2. Name of the current time surface: Now vs Today as calendar frame
