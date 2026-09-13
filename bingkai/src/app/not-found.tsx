import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-xl space-y-5 py-10">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl font-extrabold tracking-tight text-white">
        Kampanye atau halaman ini tidak ditemukan.
      </h1>
      <p className="text-sm leading-relaxed text-gray-2">
        Periksa lagi tautannya — biasanya ada huruf yang terpotong saat disalin dari
        WhatsApp. Kalau tautannya benar, mungkin kampanye ini sudah dihapus pembuatnya.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="border border-line px-5 py-3 text-sm text-gray-1 hover:bg-bg-hover"
        >
          Ke beranda
        </Link>
        <Link
          href="/buat"
          className="border border-line-strong bg-tint-gold-soft px-5 py-3 text-sm font-semibold text-gold hover:bg-tint-gold-hover"
        >
          Buat kampanye sendiri
        </Link>
      </div>
    </div>
  );
}
