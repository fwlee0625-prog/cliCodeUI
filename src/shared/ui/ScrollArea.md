# ScrollArea

Reusable scroll wrapper used by the sidebar and file tree. It keeps native wheel,
keyboard and touch scrolling, hides the platform scrollbar and overlays draggable
vertical/horizontal thumbs. Overlays appear on scroll and fade out after 800 ms.
Content without overflow has no scrollbar. Container and content resizes update
the thumbs automatically.

```tsx
import { useRef } from 'react';
import { ScrollArea } from '@/shared/ui';

const viewportRef = useRef<HTMLDivElement>(null);

<ScrollArea
  ref={viewportRef}
  className="h-64"
  viewportClassName="overscroll-contain"
  contentClassName="space-y-2 p-3"
  onScroll={(event) => console.log(event.currentTarget.scrollTop)}
>
  {items}
</ScrollArea>

// Standard DOM methods remain available.
viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
```

Set `className` for wrapper layout/height (`h-64`, `max-h-96`, or `flex-1`
inside a height-constrained flex parent). Set scroll styles on
`viewportClassName`, and content spacing on `contentClassName`.
The forwarded ref and `onScroll` refer to the native viewport.
`always` defaults to false; `hideDelay` defaults to 800 ms;
`minThumbSize` defaults to 20 px. Scrollbars support arrows,
Page Up/Down, Home and End; the viewport also supports native keyboard scrolling.

Implementation approach reference: Element Plus Scrollbar (native wrap +
observed content + overlay bar/thumb), independently implemented in React:
https://github.com/element-plus/element-plus/tree/dev/packages/components/scrollbar
