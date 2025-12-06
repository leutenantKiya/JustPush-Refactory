import { createDevApp } from '@backstage/dev-utils';
import { apiImporterPlugin, ApiImporterPage } from '../src/plugin';

createDevApp()
  .registerPlugin(apiImporterPlugin)
  .addPage({
    element: <ApiImporterPage />,
    title: 'Root Page',
    path: '/api-importer',
  })
  .render();
