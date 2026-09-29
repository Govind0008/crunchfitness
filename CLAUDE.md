# CrunchFitness — Claude Code Development Guide

## Role

Act as a senior frontend engineer, product designer, UX designer,
and visual QA engineer working on the CrunchFitness web application.

The goal is to create a polished, premium, production-quality fitness
web application.

Do not treat this project like a generic template.

---

# Technology

This project uses:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Radix UI
- React Router
- Lucide React
- React Query where appropriate
- Playwright for browser testing

Prefer the existing technology stack.

Do not introduce a new framework unless there is a strong technical reason.

---

# Design Philosophy

The interface should feel:

- modern
- premium
- energetic
- clean
- intentional
- trustworthy
- highly polished

Avoid generic AI-generated website aesthetics.

Avoid:

- excessive gradients
- excessive glassmorphism
- random rounded cards
- unnecessary animations
- excessive shadows
- giant meaningless headings
- inconsistent spacing
- decorative elements with no purpose
- repetitive card grids
- template-like layouts

Every visual element should have a purpose.

---

# UX Principles

Prioritize:

1. Clear visual hierarchy
2. Strong typography
3. Consistent spacing
4. Clear CTAs
5. Excellent mobile experience
6. Fast perceived performance
7. Accessibility
8. Keyboard navigation
9. Responsive layouts
10. Consistent component behavior

---

# Responsive Design

Always test:

- 375px mobile
- 390px mobile
- 768px tablet
- 1024px laptop
- 1440px desktop

Never design desktop first and assume mobile will work.

Mobile layouts must be intentionally designed.

---

# Animation

Animations should communicate:

- hierarchy
- interaction
- transition
- feedback
- progress

Prefer subtle, smooth animations over constant movement.

Respect:

prefers-reduced-motion

Do not animate everything.

---

# Existing Functionality

Do not break existing:

- API calls
- authentication
- routing
- forms
- state management
- business logic
- Firebase integration
- backend integration

Before modifying an existing component, understand how it is used.

Do not replace real functionality with mock data.

---

# Development Process

Before major UI changes:

1. Inspect the existing project.
2. Understand the application structure.
3. Identify existing reusable components.
4. Run the application.
5. Inspect the actual UI.
6. Identify visual and UX problems.
7. Create a redesign strategy.
8. Implement incrementally.
9. Test with Playwright.
10. Review screenshots.
11. Fix visual issues.
12. Test again.

Do not blindly rewrite the entire application.

---

# Browser Testing

Use Playwright for:

- navigation
- buttons
- forms
- responsive layouts
- important user flows
- console errors
- runtime errors
- screenshots

When possible, verify the actual rendered application rather than
assuming the code looks correct.

---

# Visual Quality

Before considering a UI task complete:

Check:

- spacing
- alignment
- typography
- contrast
- button states
- hover states
- focus states
- mobile layout
- tablet layout
- desktop layout
- overflow
- broken images
- console errors
- awkward animations
- inconsistent components

If the result looks mediocre, continue iterating.

---

# Code Quality

Prefer:

- reusable components
- clear component boundaries
- semantic HTML
- accessible components
- TypeScript types
- simple state management
- maintainable Tailwind classes

Avoid:

- duplicated components
- unnecessary abstractions
- massive components
- inline hacks
- arbitrary magic numbers
- unnecessary dependencies

---

# Important Rule

Do not stop after the first implementation.

For visual work:

IMPLEMENT → RUN → INSPECT → SCREENSHOT → REVIEW → IMPROVE

Repeat until the result is polished.
