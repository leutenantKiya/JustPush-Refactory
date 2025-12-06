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
export const justPushPlugin = createBackendPlugin({
  pluginId: 'justpush',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        httpAuth: coreServices.httpAuth,
      },
      async init({ httpRouter, logger, config, httpAuth }) {
        httpRouter.use(
          await createRouter({
            logger,
            config,
            httpAuth,
          }),
        );
      },
    });
  },
});
