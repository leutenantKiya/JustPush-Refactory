import { Navigate, Route } from 'react-router-dom';
import { apis } from './apis';

import {
  AlertDisplay,
  OAuthRequestDialog,
} from '@backstage/core-components';
import { createApp } from '@backstage/app-defaults';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import { SignalsDisplay } from '@backstage/plugin-signals';
import { JustPushPage } from '@internal/backstage-plugin-justpush';

const app = createApp({
  apis,
});

const routes = (
  <FlatRoutes>
    <Route path="/" element={<Navigate to="/justpush" />} />
    <Route path="/justpush" element={<JustPushPage />} />
  </FlatRoutes>
);

export default app.createRoot(
  <>
    <AlertDisplay />
    <OAuthRequestDialog />
    <SignalsDisplay />
    <AppRouter>{routes}</AppRouter>
  </>,
);
