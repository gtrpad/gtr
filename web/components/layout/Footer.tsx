import Image from "next/image";
import Link from "next/link";
import { X_URL } from "./Header";

const links = [
  { name: "Robinhood Chain", href: "https://docs.robinhood.com/chain/", icon: "robinhood" },
  { name: "X", href: X_URL, icon: "x" },
  { name: "GitHub", href: "https://github.com/gtrpad/gtr", icon: "github" },
];

export function Footer() {
  return (
    <footer className="footer">
      <nav className="wrap" aria-label="Social links">
        {links.map(({ name, href, icon }) => (
          <a key={icon} className="footer-link" href={href} aria-label={name} title={name} target="_blank" rel="noopener noreferrer">
            <Image src={`/brand/${icon}-dark.svg`} alt="" width={19} height={19} />
          </a>
        ))}
      </nav>
      <p className="footer-line">
        <span>GTR</span><span>·</span><a href="https://docs.robinhood.com/chain/" target="_blank" rel="noopener noreferrer">Robinhood Chain</a><span>·</span><Link href="/docs">Docs</Link><span>·</span>
        <a href={X_URL} target="_blank" rel="noopener noreferrer">X</a><span>·</span><a href="https://github.com/gtrpad/gtr" target="_blank" rel="noopener noreferrer">GitHub</a>
      </p>
    </footer>
  );
}
