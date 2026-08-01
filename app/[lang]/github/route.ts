import { redirect } from "next/navigation";

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const repository = process.env.GITHUB_REPOSITORY_URL;
  if (repository && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(repository)) redirect(repository);
  redirect(`/${lang === "en" ? "en" : "zh"}/project?github=not-connected`);
}
