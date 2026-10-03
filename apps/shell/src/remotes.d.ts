// The shell's own view of what it loads. Remote source is never imported.
declare module 'people/App' {
  import type { ComponentType } from 'react';
  const App: ComponentType;
  export default App;
}
declare module 'delivery/App' {
  import type { ComponentType } from 'react';
  const App: ComponentType;
  export default App;
}
