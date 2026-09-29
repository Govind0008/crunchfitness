# Playwright Testing Skill

Use Playwright to verify the real rendered CrunchFitness application.

## Before testing

Start the Vite development server if it is not already running.

Use the actual application rather than mocked HTML.

## Test viewports

Always consider:

- 375x812
- 390x844
- 768x1024
- 1024x768
- 1440x900

## Verify

Check:

- page loads
- navigation
- buttons
- links
- forms
- important interactions
- responsive behavior
- horizontal overflow
- console errors
- runtime errors
- broken images

## Visual testing

Take screenshots of important pages.

Use screenshots to identify:

- alignment problems
- spacing problems
- typography problems
- overflow
- broken responsive layouts
- inconsistent components

## Important rule

Do not assume that successful compilation means the UI works.

The browser must be tested.

## Failure handling

If Playwright finds an issue:

1. identify the cause
2. fix the implementation
3. rerun the test
4. verify the fix

Do not simply ignore browser failures.
