import { createDevApp } from '@backstage/dev-utils';
import { justPushPlugin, JustPushPage } from '../src/plugin';

createDevApp()
  .registerPlugin(justPushPlugin)
  .addPage({
    element: <JustPushPage />,
    title: 'JustPush Plugin',
    path: '/justpush',
  })
  .render();
