/// <reference types="vite/client" />

declare module 'react-dom/client' {
  import { ReactNode } from 'react';

  export function createRoot(container: Element | DocumentFragment): {
    render(children: ReactNode): void;
    unmount(): void;
  };
}

declare module 'react-dom' {
  import { ReactNode } from 'react';

  export function createPortal(children: ReactNode, container: Element | DocumentFragment): ReactNode;
}
