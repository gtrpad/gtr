"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ next }: { next?: string }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="adm-login">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
          if (r.ok) { router.push(next || "/admin/words"); router.refresh(); } else setErr("Неверный пароль");
        }}
      >
        <h1>Вход в админку</h1>
        <label>Пароль<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></label>
        {err && <div className="adm-msg err">{err}</div>}
        <button className="adm-btn primary" type="submit">Войти</button>
      </form>
    </div>
  );
}
