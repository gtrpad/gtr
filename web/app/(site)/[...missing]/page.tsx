import { notFound } from "next/navigation";

/** Any unmatched public URL renders the site not-found page inside the public chrome. */
export default function Missing() {
  notFound();
}
