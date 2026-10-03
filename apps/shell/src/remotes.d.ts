// The shell's own view of what it loads. Remote source is never imported.
declare module 'people/App' {
  import type { ComponentType } from 'react';
  import type { PeopleAppProps } from './contracts';
  const App: ComponentType<PeopleAppProps>;
  export default App;
}
declare module 'delivery/App' {
  import type { ComponentType } from 'react';
  import type { DeliveryAppProps } from './contracts';
  const App: ComponentType<DeliveryAppProps>;
  export default App;
}
declare module 'people/api' {
  import type { PeopleApi } from './contracts';
  export const createEmployeeQuery: PeopleApi['createEmployeeQuery'];
  export const createRateQuery: PeopleApi['createRateQuery'];
}
declare module 'delivery/api' {
  import type { DeliveryApi } from './contracts';
  export const createAllocationTotals: DeliveryApi['createAllocationTotals'];
}
