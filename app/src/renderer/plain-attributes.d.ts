/**
 * The renderer's plain attribute vocabulary (see app/README.md). A JSX type system
 * needs every non-hyphenated name declared; hyphenated names (`is-selected`,
 * `min-size`, `current-size`) are accepted by TypeScript without this. Declared types
 * are widened to match the ones Solid declares for its own element interfaces
 * (`label?: string`), because an augmentation narrower than an inheriting interface is
 * a type error.
 */
declare module "solid-js" {
  namespace JSX {
    interface HTMLAttributes<T> {
      label?: string | undefined;
      decorative?: string | undefined;
      expanded?: string | undefined;
      resizes?: string | undefined;
      orientation?: string | undefined;
      popup?: string | undefined;
      pressed?: string | undefined;
    }
  }
}

export {};
