import Link from "next/link";
export default function FormNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="text-sm text-muted-foreground">SUMIKAMI</p>
      <h1 className="mt-5 text-3xl font-semibold">This form is unavailable.</h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        It may be closed, or the link may have changed. Please contact the person who shared it with
        you.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm text-primary-foreground"
      >
        Explore Sumikami
      </Link>
    </main>
  );
}
