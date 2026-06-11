// app/page.tsx — RTMudah Landing Page (fully responsive, Tailwind)
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "RTMudah — Sistem Manajemen RT/RW Digital",
  description: "Satu platform digital untuk data warga, iuran bulanan, pengumuman, dan laporan. Dibangun khusus untuk Ketua RT/RW Indonesia.",
  openGraph: {
    title: "RTMudah — Kelola RT Lebih Mudah, Lebih Modern",
    description: "Platform manajemen RT/RW digital untuk lingkungan yang lebih tertib, transparan, dan guyub.",
    url: "https://rtmudah.com",
    siteName: "RTMudah",
    locale: "id_ID",
    type: "website",
  },
};

const FEATURES = [
  { icon: "👥", bg: "bg-green-100",  title: "Data Warga",        desc: "Kelola profil warga lengkap dengan status verifikasi, nomor KK, dan riwayat. Admin memverifikasi setiap pendaftar baru." },
  { icon: "💳", bg: "bg-blue-100",   title: "Tagihan & Iuran",   desc: "Terbitkan tagihan bulanan otomatis untuk semua warga aktif. Konfirmasi pembayaran dengan satu klik dan pantau kas RT." },
  { icon: "📢", bg: "bg-yellow-100", title: "Pengumuman",        desc: "Broadcast informasi ke seluruh warga via aplikasi. Kategorikan sebagai info, mendesak, atau kegiatan dengan preview langsung." },
  { icon: "📋", bg: "bg-pink-100",   title: "Laporan Warga",     desc: "Warga bisa melaporkan masalah lingkungan langsung dari aplikasi. Admin menangani dan menyelesaikan setiap laporan." },
  { icon: "📊", bg: "bg-purple-100", title: "Dashboard Analitik",desc: "Lihat ringkasan RT Anda dalam satu layar — total warga, tingkat pembayaran, kas terkumpul, dan grafik 6 bulan." },
  { icon: "⚙️", bg: "bg-emerald-50", title: "Multi-tenant SaaS", desc: "Setiap RT punya data terisolasi. Satu platform untuk ribuan RT se-Indonesia dengan keamanan data terjamin." },
];

const STEPS = [
  { num: 1, title: "Daftar Gratis",    desc: "Buat akun dengan email. Konfirmasi selesai dalam hitungan detik." },
  { num: 2, title: "Setup RT Anda",    desc: "Masukkan nomor RT/RW, kelurahan, dan iuran bulanan di halaman Pengaturan." },
  { num: 3, title: "Ajak Warga",       desc: "Bagikan link daftar ke warga. Mereka mendaftar, Anda verifikasi." },
  { num: 4, title: "Kelola Semuanya",  desc: "Terbitkan tagihan, kirim pengumuman, dan pantau laporan dari satu dashboard." },
];

const PLANS = [
  {
    name: "RT Aktif", price: "Rp 450.000,-", period: "/tahun",
    desc: "Untuk RT yang ingin fitur lengkap dan notifikasi otomatis",
    features: ["Hingga 200 KK", "Data & profil warga","Tagihan bulanan","Pengumuman","Laporan warga", "Notifikasi WhatsApp", "Analitik lengkap", "1 admin"],
    cta: "Coba Gratis 7 Hari", href: "/register", featured: true,
  },
  {
    name: "Pro RW", price: "Rp 149k", period: "/bulan",
    desc: "Untuk RW yang mengelola banyak RT sekaligus",
    features: ["Warga tidak terbatas", "Multi RT/RW", "Semua fitur RT Aktif", "Laporan analitik", "Admin tidak terbatas", "Prioritas dukungan"],
    cta: "Hubungi Kami", href: "mailto:hello@rtmudah.com", featured: false,
  },
];

const STATS_BAR = [
  { num: "100%", lbl: "Buka Akses Awal" },
  { num: "5 mnt", lbl: "Setup pertama" },
  { num: "Free", lbl: "Selama beta" },
  { num: "HTTPS", lbl: "Data terenkripsi" },
];

// ── Subcomponents ────────────────────────────────────────────────────
function Logo({ white = false }: { white?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 no-underline">
      <div className="w-9 h-9 bg-yellow-400 rounded-lg flex items-center justify-center font-extrabold text-sm text-blue-900">
        RT
      </div>
      <span className={`font-bold text-lg ${white ? "text-white" : "text-blue-900"}`}>
        <span className="text-yellow-400">RT</span>Mudah
      </span>
    </Link>
  );
}

function DashboardMockup() {
  const sidebar = ["Dashboard","Data Warga","Tagihan","Pengumuman","Laporan","Pengaturan"];
  const bars = [[52,8],[44,12],[56,6],[48,10],[60,8],[52,14]];
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun"];
  const warga = [
    { init: "BS", name: "Budi Santoso",  bg: "bg-blue-900",   badge: "Aktif",   bc: "bg-green-100 text-green-800" },
    { init: "SA", name: "Siti Aminah",   bg: "bg-amber-500",  badge: "Pending", bc: "bg-yellow-100 text-yellow-800" },
    { init: "AR", name: "Agus Riyanto",  bg: "bg-purple-500", badge: "Aktif",   bc: "bg-green-100 text-green-800" },
  ];

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.3)] w-full max-w-xl mx-auto">
      {/* Window bar */}
      <div className="bg-zinc-900 px-3.5 py-2.5 flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
        <div className="bg-zinc-700 rounded px-2.5 py-0.5 text-xs text-zinc-400 ml-2">
          rtmudah.com/dashboard
        </div>
      </div>
      {/* Body */}
      <div className="flex h-[260px] sm:h-[300px]">
        {/* Sidebar */}
        <div className="w-32 sm:w-36 bg-[#1a1a2e] py-3 flex-shrink-0">
          <div className="px-3 pb-2.5 border-b border-white/10 mb-2">
            <div className="text-xs font-bold text-white">RTMudah</div>
            <div className="text-[9px] text-white/40 mt-0.5">Pilih RT di pengaturan</div>
          </div>
          {sidebar.map((item, i) => (
            <div key={item} className={`px-3 py-1.5 text-[10px] flex items-center gap-1.5 ${i === 0 ? "bg-white/10 text-white" : "text-white/50"}`}>
              <div className="w-3 h-3 rounded-sm bg-white/15 flex-shrink-0" />
              <span className="truncate">{item}</span>
            </div>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 p-3 bg-gray-50 overflow-hidden">
          <div className="text-xs font-bold mb-2">Dashboard</div>
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-1 mb-2">
            {[
              { lbl: "Total Warga", val: "42",    color: "text-green-700" },
              { lbl: "Sudah Bayar", val: "38",    color: "text-green-700" },
              { lbl: "Belum Bayar", val: "4",     color: "text-red-600"   },
              { lbl: "Kas RT",      val: "1,14jt",color: "text-blue-900"  },
            ].map((s) => (
              <div key={s.lbl} className="bg-white rounded p-1.5 border border-gray-100">
                <div className="text-[7px] text-gray-500">{s.lbl}</div>
                <div className={`text-xs font-bold ${s.color} mt-0.5`}>{s.val}</div>
              </div>
            ))}
          </div>
          {/* Chart */}
          <div className="bg-white rounded p-2 border border-gray-100 mb-1.5">
            <div className="text-[9px] font-semibold mb-1.5">Pembayaran 6 Bulan</div>
            <div className="flex items-end gap-1.5 h-12 px-1">
              {bars.map(([g, r], i) => (
                <div key={i} className="flex flex-col items-center flex-1 gap-0.5">
                  <div className="flex gap-0.5 items-end">
                    <div className="w-2 rounded-t-sm bg-green-700" style={{ height: g * 0.55 }} />
                    <div className="w-2 rounded-t-sm bg-red-400"   style={{ height: r * 0.55 }} />
                  </div>
                  <div className="text-[6px] text-gray-400">{months[i]}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Warga list */}
          <div className="bg-white rounded p-1.5 border border-gray-100">
            <div className="text-[9px] font-semibold mb-1">Warga Terbaru</div>
            {warga.map((w) => (
              <div key={w.name} className="flex items-center gap-1.5 py-0.5 border-b border-gray-50 last:border-0">
                <div className={`w-4 h-4 rounded-full ${w.bg} flex items-center justify-center text-[6px] font-bold text-white flex-shrink-0`}>{w.init}</div>
                <div className="text-[8px] flex-1 truncate">{w.name}</div>
                <div className={`text-[7px] px-1.5 py-px rounded font-semibold ${w.bc}`}>{w.badge}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="font-sans text-gray-900 antialiased">

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#fitur"      className="text-sm text-gray-500 font-medium hover:text-blue-900 transition-colors">Fitur</a>
            <a href="#cara-kerja" className="text-sm text-gray-500 font-medium hover:text-blue-900 transition-colors">Cara Kerja</a>
            <a href="#harga"      className="text-sm text-gray-500 font-medium hover:text-blue-900 transition-colors">Harga</a>
            <Link href="/login"   className="text-sm text-gray-500 font-medium hover:text-blue-900 transition-colors">Masuk</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="md:hidden text-sm text-gray-600 font-medium px-3 py-1.5">
              Masuk
            </Link>
            <Link href="/register" className="bg-yellow-400 text-blue-900 px-4 py-2 rounded-lg font-bold text-sm hover:bg-yellow-300 transition-colors">
              Coba Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24 flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left max-w-lg mx-auto lg:mx-0">
            <div className="inline-flex items-center gap-1.5 bg-yellow-400/15 border border-yellow-400/30 text-yellow-400 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-wide">
              ✦ Sekarang Live — Akses Awal Gratis
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-5">
              Kelola RT Lebih{" "}
              <span className="text-yellow-400">Mudah</span>,{" "}
              Lebih Modern.
            </h1>
            <p className="text-base sm:text-lg text-yellow-100 mb-8 leading-relaxed">
              Satu platform digital untuk data warga, iuran bulanan, pengumuman, dan laporan.
              Dibangun khusus untuk Ketua RT/RW Indonesia.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link href="/register" className="bg-yellow-400 text-blue-900 px-6 py-3.5 rounded-lg font-bold text-sm sm:text-base hover:bg-yellow-300 transition-colors text-center">
                Mulai Gratis Sekarang
              </Link>
              <Link href="/login" className="bg-white/10 border border-white/20 text-white px-6 py-3.5 rounded-lg font-semibold text-sm sm:text-base hover:bg-white/20 transition-colors text-center">
                Lihat Demo
              </Link>
            </div>
            <p className="text-xs text-white/40 mt-4">Tidak perlu kartu kredit. Setup dalam 5 menit.</p>
          </div>
          {/* Mockup — hidden on small, visible md+ */}
          <div className="flex-1 w-full max-w-sm sm:max-w-md lg:max-w-xl hidden sm:block">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────── */}
      <div className="bg-yellow-400 py-5">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS_BAR.map((s) => (
            <div key={s.lbl} className="text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-900">{s.num}</div>
              <div className="text-xs font-semibold text-blue-900/70 mt-0.5">{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section id="fitur" className="py-16 sm:py-20 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-xs font-bold text-green-700 tracking-widest uppercase mb-3">Fitur Platform</div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-4">
          Semua yang Ketua RT <span className="text-green-700">butuhkan</span>
        </h2>
        <p className="text-base sm:text-lg text-gray-500 max-w-xl mb-12 leading-relaxed">
          Dibangun dari nol dengan teknologi modern. Setiap fitur dirancang untuk menyederhanakan pekerjaan pengurus RT.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 ${f.bg} rounded-lg flex items-center justify-center text-2xl mb-4`}>{f.icon}</div>
              <h3 className="text-base font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              <div className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full mt-3">
                ✓ Sudah live
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section id="cara-kerja" className="bg-gray-50 py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-bold text-green-700 tracking-widest uppercase mb-3">Cara Kerja</div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-4">
              Mulai dalam <span className="text-green-700">4 langkah</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-500 max-w-md mx-auto">
              Tidak perlu keahlian teknis. Tidak perlu instalasi. Langsung dari browser.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {STEPS.map((s) => (
              <div key={s.num} className="text-center px-4">
                <div className="w-12 h-12 rounded-full bg-green-700 text-white flex items-center justify-center font-extrabold text-lg mx-auto mb-4">
                  {s.num}
                </div>
                <h3 className="text-sm font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────── */}
      <section id="harga" className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-xs font-bold text-green-700 tracking-widest uppercase mb-3">Harga</div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-4">
            Transparan & <span className="text-green-700">Terjangkau</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-500 max-w-md mx-auto mb-12">
            Mulai gratis selama masa beta. Tidak ada biaya tersembunyi.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PLANS.map((p) => (
              <div key={p.name} className={`bg-white rounded-xl p-7 text-left relative ${p.featured ? "border-2 border-green-700 shadow-lg" : "border border-gray-200"}`}>
                {p.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-700 text-white px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                    Paling Populer
                  </div>
                )}
                <div className="text-sm font-bold text-gray-500 mb-2">{p.name}</div>
                <div className="text-3xl font-extrabold mb-1">
                  {p.price}<span className="text-base font-medium text-gray-500">{p.period}</span>
                </div>
                <div className="text-sm text-gray-500 mb-5 pb-5 border-b border-gray-100">{p.desc}</div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="text-green-700 font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className={`block w-full py-3 rounded-lg font-bold text-sm text-center transition-colors ${p.featured ? "bg-green-700 text-white hover:bg-green-800" : "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50"}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-8">
            * Selama masa beta, semua fitur tersedia gratis. Harga di atas berlaku saat launch resmi.
          </p>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="bg-blue-900 text-white py-16 sm:py-20 px-4 sm:px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-xs font-bold text-yellow-400 tracking-widest uppercase mb-3">Mulai Sekarang</div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-4">
            RT Anda layak punya sistem<br className="hidden sm:block" /> yang lebih baik.
          </h2>
          <p className="text-base sm:text-lg text-white/70 max-w-md mx-auto mb-8 leading-relaxed">
            Bergabung dalam akses awal dan bantu kami membangun platform RT/RW terbaik di Indonesia.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="bg-yellow-400 text-blue-900 px-6 py-3.5 rounded-lg font-bold text-sm sm:text-base hover:bg-yellow-300 transition-colors">
              Daftar Akses Awal — Gratis
            </Link>
            <a href="https://wa.me/6281234567890" className="bg-white/10 border border-white/20 text-white px-6 py-3.5 rounded-lg font-semibold text-sm sm:text-base hover:bg-white/20 transition-colors">
              Chat via WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-white/60 py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 mb-10">
            {/* Brand */}
            <div>
              <Logo white />
              <p className="text-sm mt-3 leading-relaxed max-w-xs">
                Platform manajemen RT/RW digital untuk lingkungan yang lebih tertib, transparan, dan guyub.
              </p>
            </div>
            {/* Platform links */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Platform</h4>
              <ul className="space-y-2">
                {[["#fitur","Fitur"],["#cara-kerja","Cara Kerja"],["#harga","Harga"],["/login","Masuk"],["/register","Daftar"]].map(([href, label]) => (
                  <li key={label}>
                    <Link href={href} className="text-sm hover:text-white transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            {/* Contact */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Kontak</h4>
              <ul className="space-y-2">
                <li><a href="mailto:hello@rtmudah.com" className="text-sm hover:text-white transition-colors">hello@rtmudah.com</a></li>
                <li><a href="https://wa.me/6281234567890" className="text-sm hover:text-white transition-colors">WhatsApp</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-xs text-center">
            © 2026 RTMudah. Dibangun dengan ❤️ untuk Indonesia. oleh PT Langit Strategi Indonesia
          </div>
        </div>
      </footer>

    </div>
  );
}
