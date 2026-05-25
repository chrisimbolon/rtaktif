// app/page.tsx
// RTMudah Landing Page — replaces the redirect to /login
// Visitors see this first, then click Masuk/Daftar to go to /login or /register
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "RTMudah — Sistem Manajemen RT/RW Digital",
  description:
    "Satu platform digital untuk data warga, iuran bulanan, pengumuman, dan laporan. Dibangun khusus untuk Ketua RT/RW Indonesia.",
  openGraph: {
    title: "RTMudah — Kelola RT Lebih Mudah, Lebih Modern",
    description: "Platform manajemen RT/RW digital untuk lingkungan yang lebih tertib, transparan, dan guyub.",
    url: "https://rtmudah.com",
    siteName: "RTMudah",
    locale: "id_ID",
    type: "website",
  },
};

// ── Data ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: "👥",
    bg: "#d1fae5",
    title: "Data Warga",
    desc: "Kelola profil warga lengkap dengan status verifikasi, nomor KK, dan riwayat. Admin memverifikasi setiap pendaftar baru.",
    live: true,
  },
  {
    icon: "💳",
    bg: "#dbeafe",
    title: "Tagihan & Iuran",
    desc: "Generate tagihan bulanan otomatis untuk semua warga aktif. Konfirmasi pembayaran dengan satu klik dan pantau kas RT.",
    live: true,
  },
  {
    icon: "📢",
    bg: "#fef3c7",
    title: "Pengumuman",
    desc: "Broadcast informasi ke seluruh warga via aplikasi. Kategorikan sebagai info, mendesak, atau kegiatan dengan preview langsung.",
    live: true,
  },
  {
    icon: "📋",
    bg: "#fce7f3",
    title: "Laporan Warga",
    desc: "Warga bisa melaporkan masalah lingkungan langsung dari aplikasi. Admin menangani dan menyelesaikan setiap laporan.",
    live: true,
  },
  {
    icon: "📊",
    bg: "#ede9fe",
    title: "Dashboard Analitik",
    desc: "Lihat ringkasan RT Anda dalam satu layar — total warga, tingkat pembayaran, kas terkumpul, dan grafik 6 bulan.",
    live: true,
  },
  {
    icon: "⚙️",
    bg: "#f0fdf4",
    title: "Multi-tenant SaaS",
    desc: "Setiap RT punya data terisolasi. Satu platform untuk ribuan RT se-Indonesia dengan keamanan data terjamin.",
    live: true,
  },
];

const STEPS = [
  { num: 1, title: "Daftar Gratis", desc: "Buat akun dengan email. Konfirmasi selesai dalam hitungan detik." },
  { num: 2, title: "Setup RT Anda", desc: "Masukkan nomor RT/RW, kelurahan, dan iuran bulanan di halaman Pengaturan." },
  { num: 3, title: "Ajak Warga", desc: "Bagikan link daftar ke warga. Mereka mendaftar, Anda verifikasi." },
  { num: 4, title: "Kelola Semuanya", desc: "Generate tagihan, kirim pengumuman, dan pantau laporan dari satu dashboard." },
];

const PLANS = [
  {
    name: "Starter",
    price: "Gratis",
    period: "/selamanya",
    desc: "Untuk RT kecil yang baru memulai digitalisasi",
    features: ["Hingga 50 KK", "Data & profil warga", "Tagihan bulanan", "Pengumuman dasar", "1 admin"],
    cta: "Mulai Gratis",
    href: "/register",
    featured: false,
  },
  {
    name: "RT Aktif",
    price: "Rp 49k",
    period: "/bulan",
    desc: "Untuk RT yang ingin fitur lengkap dan notifikasi otomatis",
    features: ["Hingga 150 KK", "Semua fitur Starter", "Laporan warga", "Notifikasi WhatsApp", "Analitik lengkap", "3 admin"],
    cta: "Coba Gratis 30 Hari",
    href: "/register",
    featured: true,
  },
  {
    name: "Pro RW",
    price: "Rp 149k",
    period: "/bulan",
    desc: "Untuk RW yang mengelola banyak RT sekaligus",
    features: ["Warga tidak terbatas", "Multi RT/RW", "Semua fitur RT Aktif", "Laporan analitik", "Admin tidak terbatas", "Prioritas dukungan"],
    cta: "Hubungi Kami",
    href: "mailto:hello@rtmudah.com",
    featured: false,
  },
];

// ── Component ────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#212529", lineHeight: "1.6" }}>

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav style={{ background: "white", borderBottom: "1px solid #e9ecef", padding: "0 5%", position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 36, height: 36, background: "#F5B800", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#1A3A6B" }}>RT</div>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#1A3A6B" }}><span style={{ color: "#F5B800" }}>RT</span>Mudah</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#fitur"      style={{ textDecoration: "none", color: "#6c757d", fontSize: 14, fontWeight: 500 }}>Fitur</a>
          <a href="#cara-kerja" style={{ textDecoration: "none", color: "#6c757d", fontSize: 14, fontWeight: 500 }}>Cara Kerja</a>
          <a href="#harga"      style={{ textDecoration: "none", color: "#6c757d", fontSize: 14, fontWeight: 500 }}>Harga</a>
          <Link href="/login"    style={{ textDecoration: "none", color: "#6c757d", fontSize: 14, fontWeight: 500 }}>Masuk</Link>
          <Link href="/register" style={{ background: "#F5B800", color: "#1A3A6B", padding: "8px 20px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            Coba Gratis
          </Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section style={{ background: "linear-gradient(135deg, #1A3A6B 0%, #2D5AA0 100%)", color: "white", padding: "80px 5% 60px", display: "flex", alignItems: "center", gap: 60, minHeight: 560, flexWrap: "wrap" }}>
        <div style={{ flex: 1, maxWidth: 520, minWidth: 280 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(245,184,0,0.15)", border: "1px solid rgba(245,184,0,0.3)", color: "#F5B800", padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600, marginBottom: 24, letterSpacing: "0.5px" }}>
            ✦ Sekarang Live — Early Access Gratis
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.15, marginBottom: 20 }}>
            Kelola RT Lebih <span style={{ color: "#F5B800" }}>Mudah</span>, Lebih Modern.
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", marginBottom: 36, lineHeight: 1.7 }}>
            Satu platform digital untuk data warga, iuran bulanan, pengumuman, dan laporan. Dibangun khusus untuk Ketua RT/RW Indonesia.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/register" style={{ background: "#F5B800", color: "#1A3A6B", padding: "14px 28px", borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              Mulai Gratis Sekarang
            </Link>
            <Link href="/login" style={{ background: "rgba(255,255,255,0.1)", color: "white", padding: "14px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: "none", border: "1px solid rgba(255,255,255,0.2)" }}>
              Lihat Demo
            </Link>
          </div>
          <p style={{ marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            Tidak perlu kartu kredit. Setup dalam 5 menit.
          </p>
        </div>

        {/* Dashboard mockup */}
        <div style={{ flex: 1, maxWidth: 540, minWidth: 300 }}>
          <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }}>
            <div style={{ background: "#1c1c1e", padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }}/>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }}/>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }}/>
              <div style={{ background: "#3a3a3c", borderRadius: 4, padding: "3px 10px", fontSize: 11, color: "#8e8e93", marginLeft: 8 }}>rtmudah.com/dashboard</div>
            </div>
            <div style={{ display: "flex", height: 300 }}>
              {/* Sidebar */}
              <div style={{ width: 140, background: "#1a1a2e", padding: "16px 0", flexShrink: 0 }}>
                <div style={{ padding: "0 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "white" }}>RTMudah</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Pilih RT di pengaturan</div>
                </div>
                {["Dashboard","Data Warga","Tagihan","Pengumuman","Laporan","Pengaturan"].map((item, i) => (
                  <div key={item} style={{ padding: "7px 16px", fontSize: 10, color: i === 0 ? "white" : "rgba(255,255,255,0.5)", background: i === 0 ? "rgba(255,255,255,0.1)" : "transparent", display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 14, height: 14, background: "rgba(255,255,255,0.15)", borderRadius: 3, flexShrink: 0 }}/>
                    {item}
                  </div>
                ))}
              </div>
              {/* Content */}
              <div style={{ flex: 1, padding: 14, background: "#f8f9fa", overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Dashboard</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 10 }}>
                  {[
                    { label: "Total Warga", val: "42", color: "#1B6B3A" },
                    { label: "Sudah Bayar", val: "38", color: "#1B6B3A" },
                    { label: "Belum Bayar", val: "4",  color: "#dc3545" },
                    { label: "Kas RT",      val: "1,14jt", color: "#1A3A6B" },
                  ].map((s) => (
                    <div key={s.label} style={{ background: "white", borderRadius: 5, padding: "6px 8px", border: "1px solid #e9ecef" }}>
                      <div style={{ fontSize: 8, color: "#6c757d" }}>{s.label}</div>
                      <div style={{ fontSize: s.val.length > 3 ? 11 : 15, fontWeight: 700, color: s.color, margin: "2px 0" }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                {/* Mini chart */}
                <div style={{ background: "white", borderRadius: 5, padding: "8px", border: "1px solid #e9ecef", marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, marginBottom: 6 }}>Pembayaran 6 Bulan</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56, padding: "0 4px" }}>
                    {[
                      [52,8],[44,12],[56,6],[48,10],[60,8],[52,14]
                    ].map(([g,r], i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 1 }}>
                        <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
                          <div style={{ width: 8, height: g * 0.7, background: "#1B6B3A", borderRadius: "2px 2px 0 0" }}/>
                          <div style={{ width: 8, height: r * 0.7, background: "#ef4444", borderRadius: "2px 2px 0 0" }}/>
                        </div>
                        <div style={{ fontSize: 7, color: "#adb5bd" }}>{["Jan","Feb","Mar","Apr","Mei","Jun"][i]}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Warga list */}
                <div style={{ background: "white", borderRadius: 5, padding: "6px 8px", border: "1px solid #e9ecef" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, marginBottom: 4 }}>Warga Terbaru</div>
                  {[
                    { init: "BS", name: "Budi Santoso",    color: "#1A3A6B", badge: "Aktif",   bc: "#d1fae5", tc: "#065f46" },
                    { init: "SA", name: "Siti Aminah",     color: "#f59e0b", badge: "Pending", bc: "#fef3c7", tc: "#92400e" },
                    { init: "AR", name: "Agus Riyanto",    color: "#8b5cf6", badge: "Aktif",   bc: "#d1fae5", tc: "#065f46" },
                  ].map((w) => (
                    <div key={w.name} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 0", borderBottom: "1px solid #f1f3f5" }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: w.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, fontWeight: 700, color: "white", flexShrink: 0 }}>{w.init}</div>
                      <div style={{ fontSize: 8, flex: 1 }}>{w.name}</div>
                      <div style={{ fontSize: 7, padding: "1px 5px", borderRadius: 3, background: w.bc, color: w.tc, fontWeight: 600 }}>{w.badge}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────── */}
      <div style={{ background: "#F5B800", padding: "20px 5%", display: "flex", justifyContent: "center", gap: 60, flexWrap: "wrap" }}>
        {[
          { num: "100%", lbl: "Open Early Access" },
          { num: "5 mnt", lbl: "Setup pertama" },
          { num: "Free", lbl: "Selama beta" },
          { num: "HTTPS", lbl: "Data terenkripsi" },
        ].map((s) => (
          <div key={s.lbl} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1A3A6B" }}>{s.num}</div>
            <div style={{ fontSize: 12, color: "#1A3A6B", opacity: 0.7, fontWeight: 600 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section id="fitur" style={{ padding: "80px 5%" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1B6B3A", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>Fitur Platform</div>
        <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>Semua yang Ketua RT <span style={{ color: "#1B6B3A" }}>butuhkan</span></h2>
        <p style={{ fontSize: 17, color: "#6c757d", maxWidth: 540, lineHeight: 1.7, marginBottom: 48 }}>
          Dibangun dari nol dengan teknologi modern. Setiap fitur dirancang untuk menyederhanakan pekerjaan pengurus RT.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: "white", border: "1px solid #e9ecef", borderRadius: 12, padding: 28 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, fontSize: 22 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#6c757d", lineHeight: 1.6 }}>{f.desc}</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 100, marginTop: 12, background: "#d1fae5", color: "#065f46" }}>
                ✓ Sudah live
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section id="cara-kerja" style={{ padding: "80px 5%", background: "#f8f9fa" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1B6B3A", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>Cara Kerja</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>Mulai dalam <span style={{ color: "#1B6B3A" }}>4 langkah</span></h2>
          <p style={{ fontSize: 17, color: "#6c757d", maxWidth: 480, margin: "0 auto" }}>Tidak perlu keahlian teknis. Tidak perlu instalasi. Langsung dari browser.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
          {STEPS.map((s) => (
            <div key={s.num} style={{ textAlign: "center", padding: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1B6B3A", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, margin: "0 auto 16px" }}>{s.num}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: "#6c757d" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────── */}
      <section id="harga" style={{ padding: "80px 5%", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1B6B3A", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>Harga</div>
        <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>Transparan & <span style={{ color: "#1B6B3A" }}>Terjangkau</span></h2>
        <p style={{ fontSize: 17, color: "#6c757d", maxWidth: 480, margin: "0 auto 48px" }}>Mulai gratis selama masa beta. Tidak ada biaya tersembunyi.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, maxWidth: 900, margin: "0 auto" }}>
          {PLANS.map((p) => (
            <div key={p.name} style={{ background: "white", border: p.featured ? "2px solid #1B6B3A" : "1px solid #e9ecef", borderRadius: 12, padding: 32, position: "relative" }}>
              {p.featured && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#1B6B3A", color: "white", padding: "4px 16px", borderRadius: 100, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                  Paling Populer
                </div>
              )}
              <div style={{ fontSize: 14, fontWeight: 700, color: "#6c757d", marginBottom: 8 }}>{p.name}</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "#212529", marginBottom: 4 }}>
                {p.price}<span style={{ fontSize: 15, fontWeight: 500, color: "#6c757d" }}>{p.period}</span>
              </div>
              <div style={{ fontSize: 13, color: "#6c757d", marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid #f1f3f5" }}>{p.desc}</div>
              <ul style={{ listStyle: "none", marginBottom: 24, textAlign: "left" }}>
                {p.features.map((f) => (
                  <li key={f} style={{ fontSize: 13, color: "#495057", padding: "5px 0", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#1B6B3A", fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href={p.href} style={{ display: "block", width: "100%", padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 14, textAlign: "center", textDecoration: "none", background: p.featured ? "#1B6B3A" : "white", color: p.featured ? "white" : "#212529", border: p.featured ? "none" : "1.5px solid #e9ecef" }}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: "#6c757d", marginTop: 32 }}>* Selama masa beta, semua fitur tersedia gratis. Harga di atas berlaku saat launch resmi.</p>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section style={{ background: "#1A3A6B", color: "white", padding: "80px 5%", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#F5B800", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>Mulai Sekarang</div>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "white", marginBottom: 16 }}>RT Anda layak punya sistem<br />yang lebih baik.</h2>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", maxWidth: 480, margin: "0 auto 36px", lineHeight: 1.7 }}>
          Bergabung dalam early access dan bantu kami membangun platform RT/RW terbaik di Indonesia.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" style={{ background: "#F5B800", color: "#1A3A6B", padding: "14px 28px", borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
            Daftar Early Access — Gratis
          </Link>
          <a href="https://wa.me/6281234567890" style={{ background: "rgba(255,255,255,0.1)", color: "white", padding: "14px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: "none", border: "1px solid rgba(255,255,255,0.2)" }}>
            Chat via WhatsApp
          </a>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer style={{ background: "#212529", color: "rgba(255,255,255,0.6)", padding: "48px 5% 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 40, marginBottom: 40, flexWrap: "wrap" }}>
          <div>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, background: "#F5B800", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: "#1A3A6B" }}>RT</div>
              <span style={{ fontWeight: 700, fontSize: 16, color: "white" }}><span style={{ color: "#F5B800" }}>RT</span>Mudah</span>
            </Link>
            <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 240 }}>Platform manajemen RT/RW digital untuk lingkungan yang lebih tertib, transparan, dan guyub.</p>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: "white", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Platform</h4>
            <ul style={{ listStyle: "none" }}>
              {[["#fitur","Fitur"],["#cara-kerja","Cara Kerja"],["#harga","Harga"],["/login","Masuk"],["/register","Daftar"]].map(([href, label]) => (
                <li key={label} style={{ marginBottom: 8 }}>
                  <Link href={href} style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: 14 }}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: "white", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Kontak</h4>
            <ul style={{ listStyle: "none" }}>
              <li style={{ marginBottom: 8 }}><a href="mailto:hello@rtmudah.com" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: 14 }}>hello@rtmudah.com</a></li>
              <li style={{ marginBottom: 8 }}><a href="https://wa.me/6281234567890" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: 14 }}>WhatsApp</a></li>
            </ul>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 24, fontSize: 13, textAlign: "center" }}>
          © 2026 RTMudah. Dibangun dengan ❤️ untuk Indonesia.
        </div>
      </footer>

    </div>
  );
}
