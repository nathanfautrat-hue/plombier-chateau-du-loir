// Reçoit le formulaire et envoie la demande par e-mail à Nathan (Resend).
// Variables Cloudflare : RESEND_API_KEY, MAIL_TO, MAIL_FROM
const BESOINS = ["Fuite d'eau", "Chauffe-eau", "Chaudière / chauffage", "Salle de bain", "Débouchage", "Autre"];

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestPost({ request, env }) {
  try {
    if (!env.RESEND_API_KEY || !env.MAIL_TO || !env.MAIL_FROM) return Response.json({ ok: false, code: "config", manque: ["RESEND_API_KEY", "MAIL_TO", "MAIL_FROM"].filter((k) => !env[k]), vues: Object.keys(env).filter((k) => k === k.toUpperCase()) }, { status: 500 });
    const d = await request.json();
    if (d.site) return Response.json({ ok: true }); // piège à robots

    const nom = clean(d.nom, 80);
    const telephone = clean(d.telephone, 20);
    const email = clean(d.email, 120);
    const commune = clean(d.commune, 60);
    const besoin = clean(d.besoin, 40);
    const message = clean(d.message, 1500);

    const telOk = /^[0-9+ .()-]{10,20}$/.test(telephone);
    const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!nom || !telOk || !mailOk || !commune || !BESOINS.includes(besoin) || !message || d.accord !== "on") {
      return Response.json({ ok: false }, { status: 400 });
    }

    const lignes = [
      ["Nom", nom], ["Téléphone", telephone], ["E-mail", email],
      ["Commune", commune], ["Besoin", besoin], ["Message", message],
      ["Reçue le", new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })],
    ];
    const html = `<h2>Nouvelle demande de devis plomberie</h2><table cellpadding="6">${lignes
      .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [env.MAIL_TO],
        reply_to: email,
        subject: `Demande plomberie : ${besoin} à ${commune}`,
        html,
      }),
    });
    if (!r.ok) {
      console.log("Resend refus", r.status, (await r.text()).slice(0, 300));
      return Response.json({ ok: false, code: r.status }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
