// Test stub for `@theme/Heading`.
//
// The real component renders the requested heading element with the theme's
// anchor-link behaviour. Unit tests only need the element it asks for, so
// this stub renders the `as` tag with the remaining props.

import React from 'react';

export default function Heading({ as: As, children, ...rest }) {
  return React.createElement(As, rest, children);
}
