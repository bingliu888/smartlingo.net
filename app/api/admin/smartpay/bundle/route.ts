import { requirePermanentAdmin } from "../../../../../lib/member";
import { GET as readDeploymentBundle, POST as publishDeploymentSource } from "../deployment/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePermanentAdmin();
  void request;
  return readDeploymentBundle();
}

export async function POST(request: Request) {
  await requirePermanentAdmin();
  return publishDeploymentSource(request);
}
