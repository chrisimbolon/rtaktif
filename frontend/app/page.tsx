export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* HERO */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold">
          Kelola Iuran RT Tanpa Ribet
        </h1>
        <p className="mt-4 text-muted-foreground">
          Catat pembayaran, kirim reminder WhatsApp,
          dan pantau warga dalam satu dashboard.
        </p>

        <div className="mt-6 flex justify-center gap-4">
          <a
            href="/"
            className="rounded-lg bg-black px-6 py-3 text-white"
          >
            Lihat Demo
          </a>
          <a
            href="/warga"
            className="rounded-lg border px-6 py-3"
          >
            Masuk Dashboard
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-4xl px-6 py-12 grid gap-6 md:grid-cols-3 text-center">
        <div>
          <h3 className="font-semibold">Iuran Otomatis</h3>
          <p className="text-sm text-muted-foreground">
            Tagihan dibuat otomatis setiap bulan
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Reminder WhatsApp</h3>
          <p className="text-sm text-muted-foreground">
            Kirim pengingat ke warga dengan sekali klik
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Pantau Pembayaran</h3>
          <p className="text-sm text-muted-foreground">
            Lihat siapa yang belum bayar dengan mudah
          </p>
        </div>
      </section>
    </main>
  );
}