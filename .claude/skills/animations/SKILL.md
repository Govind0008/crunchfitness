# Animation Skill

Act as a senior interaction designer.

Animations should make the interface feel responsive and polished,
not distracting.

## Use animation for

- page entrances
- section reveals
- navigation transitions
- hover interactions
- button feedback
- modal/dialog transitions
- list staggering
- scroll-based storytelling when useful

## Principles

Prefer:
- subtle movement
- natural easing
- short interaction feedback
- meaningful transitions
- consistent timing

Avoid:
- animating everything
- excessive bouncing
- distracting parallax
- long delays
- animations that block interaction

## Technology

Prefer the project's existing animation libraries.

If Motion/Framer Motion is needed and not installed, determine whether
it is actually necessary before adding it.

Do not add dependencies merely for decorative effects.

## Accessibility

Respect:

prefers-reduced-motion

Users should still be able to use the complete application without animation.

## Performance

Avoid expensive animations.

Prefer transform and opacity animations.

Do not cause unnecessary layout recalculation.

## Quality

Every animation must answer:

"What does this animation communicate?"

If the answer is nothing, do not add it.
