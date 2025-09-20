export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(99,102,241,0.25),transparent_55%),radial-gradient(90%_70%_at_100%_20%,rgba(14,165,233,0.2),transparent_60%)]"
      />
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_32px_64px_-32px_rgba(15,23,42,0.65)] backdrop-blur">
        {children}
      </div>
    </div>
  );
}
