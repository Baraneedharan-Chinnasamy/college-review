import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-500">
        The college or page you are looking for doesn&apos;t exist or was removed.
      </p>
      <ButtonLink href="/colleges" className="mt-8">
        Browse colleges
      </ButtonLink>
    </div>
  );
}
