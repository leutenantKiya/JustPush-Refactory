import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const justPushPlugin = createPlugin({
  id: 'justpush',
  routes: {
    root: rootRouteRef,
  },
});

export const JustPushPage = justPushPlugin.provide(
  createRoutableExtension({
    name: 'JustPushPage',
    component: () =>
      import('./components/ImporterComponent/ImporterComponent').then(m => m.ImporterComponent),
    mountPoint: rootRouteRef,
  }),
);
