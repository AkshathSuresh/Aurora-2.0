// global.d.ts  (place in project root, next to tsconfig.json)
/// <reference types="react" />
/// <reference types="react-dom" />

import * as React from "react";

/**
 * If your environment can't pick up @types/react for some reason,
 * this file ensures the essential JSX types exist so TS and your editor stop erroring.
 *
 * When @types/react is present, these resolve to the same underlying definitions.
 */

declare global {
  namespace JSX {
    // Basic element type expected by React/TS ecosystems
    // Use React.ReactElement so runtime typings remain consistent
    type Element = React.ReactElement<any, any>;

    // Compatible with React's Attributes
    interface IntrinsicAttributes extends React.Attributes {}

    // Allow class components fallback
    interface IntrinsicClassAttributes<T> {}

    // Fallback for intrinsic elements (allow any HTML/SVG tag)
    // This keeps TS from erroring when an unknown tag is used in JSX
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};
