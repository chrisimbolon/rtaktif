import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white py-24">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Kelola Iuran RT <br />
            <span className="text-gray-500">Tanpa Ribet</span>
          </h1>

          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
            Catat pembayaran, kirim reminder WhatsApp, dan pantau warga
            dalam satu dashboard sederhana.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            <Button className="px-6 py-3 text-base">
              Lihat Demo
            </Button>

            <Button variant="outline" className="px-6 py-3 text-base">
              Masuk Dashboard
            </Button>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF / TRUST */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-6 text-center text-sm text-gray-500">
          Dipakai oleh pengurus RT untuk mengelola iuran dan warga dengan lebih rapi
        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-2xl border bg-white shadow-sm p-4">
            {/* Replace this with real screenshot later */}
            <div className="aspect-video rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
              Dashboard Preview (replace with screenshot)
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-8 md:grid-cols-3">
            
            <div className="rounded-xl bg-white p-6 shadow-sm border">
              <h3 className="font-semibold text-lg">
                Iuran Otomatis
              </h3>
              <p className="mt-2 text-gray-600 text-sm">
                Tagihan dibuat otomatis setiap bulan tanpa ribet.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm border">
              <h3 className="font-semibold text-lg">
                Reminder WhatsApp
              </h3>
              <p className="mt-2 text-gray-600 text-sm">
                Kirim pengingat ke warga hanya dengan satu klik.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm border">
              <h3 className="font-semibold text-lg">
                Pantau Pembayaran
              </h3>
              <p className="mt-2 text-gray-600 text-sm">
                Lihat siapa yang belum bayar dengan mudah.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold">
            Mulai Kelola RT Lebih Mudah
          </h2>

          <p className="mt-4 text-gray-600">
            Mulai dari Rp30.000 / bulan
          </p>

          <div className="mt-8">
            <Button className="px-8 py-4 text-lg">
              Mulai Sekarang
            </Button>
          </div>
        </div>
      </section>

    </main>
  );
}