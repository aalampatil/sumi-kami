import Link from "next/link";
import { InkMark } from "~/components/brand/ink-art";
export function Brand() {
  return (
    <Link
      href="/"
      aria-label="Sumikami home"
      className="inline-flex min-h-11 items-center gap-3 text-lg font-semibold tracking-tight"
    >
      <InkMark className="size-9" />
      Sumikami<span className="sr-only"> · Ink meets interaction</span>
    </Link>
  );
}
