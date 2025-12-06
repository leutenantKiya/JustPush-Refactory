import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

/**
 * apiImporterPlugin backend plugin
 *
 * @public
 */
export const apiImporterPlugin = createBackendPlugin({
  pluginId: 'api-importer',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ httpRouter, logger }) {
        httpRouter.use(
          await createRouter({
            logger,
          }),
        );
      },
    });
  },
});
