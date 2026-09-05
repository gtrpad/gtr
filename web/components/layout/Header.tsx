import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { ConnectButton } from "@/components/wallet/ConnectButton";

export const X_URL = "https://x.com/gtrpad";

export function Header() {
  return (
    <header className="header">
      <div className="wrap">
        <Link className="wordmark plain" href="/" aria-label="GTR home">
          <span className="dots" aria-hidden="true">
            <i className="dot-blue" />
            <i className="dot-red" />
            <i className="dot-yellow" />
            <i className="dot-green" />
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gtr-mark.png" alt="GTR" height={22} style={{ height: 22, width: "auto", display: "block" }} />
        </Link>
        <NavLinks />
        <div className="header-r">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
