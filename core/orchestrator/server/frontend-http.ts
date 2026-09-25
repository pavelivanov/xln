import { prepareVerifiedDeployment } from '../../../packages/frontend-release/deployment-http';
import { safeStringify } from '../../protocol/serialization';

export const prepareFrontendHttpHandler = async (deploymentRoot: string | undefined) => {
  const deployedFrontend = deploymentRoot === undefined ? undefined : await prepareVerifiedDeployment(deploymentRoot);

  return async (request: Request, pathname: string, headers: HeadersInit): Promise<Response> => {
    const response = deployedFrontend ? await deployedFrontend.serve(request) : null;
    if (response) return response;

    return new Response(
      safeStringify({
        error: `Unhandled mesh-control route: ${request.method} ${pathname}`,
      }),
      { status: 404, headers },
    );
  };
};
