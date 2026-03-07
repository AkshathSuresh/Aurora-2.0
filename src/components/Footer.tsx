import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-[color:var(--border)] mt-12 bg-white">
      <div className="container py-4 md:py-6 px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs md:text-sm text-slate-500">
          <div className="text-center sm:text-left">© {new Date().getFullYear()} Aurora 2.0 by Nature & Photography Club</div>
          <div className="flex items-center gap-3">
            <div>Built with ❤️</div>
            <Image
              src="/iifm.svg"
              alt="IIFM logo"
              width={64}
              height={64}
              className="w-10 h-10 md:w-12 md:h-12 object-contain"
              priority={false}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}