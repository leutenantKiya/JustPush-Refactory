import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const apiImporterPlugin = createPlugin({
  id: 'api-importer',
  routes: {
    root: rootRouteRef,
  },
});

export const ApiImporterPage = apiImporterPlugin.provide(
  createRoutableExtension({
    name: 'ApiImporterPage',
    component: () =>
      import('./components/ImporterComponent/ImporterComponent').then(m => m.ImporterComponent),
    mountPoint: rootRouteRef,
  }),
);
