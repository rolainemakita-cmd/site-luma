// Worker du site Lumâ.
// Les fichiers de public/ sont servis directement par Cloudflare, sans passer par ce script.
// N'arrivent ici que les pages (voir run_worker_first dans wrangler.jsonc), le formulaire (/demande)
// et les adresses /video/...
// - une page demandée en http:// ou sur www. est renvoyée vers https://lumamouvement.com
//   (sinon les navigateurs affichent « Non sécurisé ») ;
// - le formulaire « Réserver » est envoyé par e-mail à la boîte de Lumâ (Email Routing de Cloudflare,
//   lien COURRIER dans wrangler.jsonc) ; la réponse part vers l'e-mail de la visiteuse (Reply-To) ;
// - la vidéo de public/media/ est renvoyée par morceaux (requêtes « Range »), sans quoi
//   Safari sur iPhone et iPad refuse de la lire.
import { EmailMessage } from "cloudflare:email";

const BOITE = "atelier.mouvement.luma@gmail.com";

// Un texte UTF-8 en base64
const base64 = (texte) => {
  const octets = new TextEncoder().encode(texte);
  let binaire = "";
  for (let i = 0; i < octets.length; i += 8192) binaire += String.fromCharCode(...octets.subarray(i, i + 8192));
  return btoa(binaire);
};
const enTete = (texte) => `=?UTF-8?B?${base64(texte)}?=`;
const json = (donnees, statut = 200) =>
  new Response(JSON.stringify(donnees), { status: statut, headers: { "content-type": "application/json" } });

async function demande(requete, env) {
  if (requete.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const origine = requete.headers.get("origin");
  if (origine && origine !== "https://lumamouvement.com") return json({ ok: false }, 403);
  let d;
  try { d = await requete.json(); } catch { return json({ ok: false }, 400); }
  // Une ligne par champ, sans retour à la ligne ; le message garde les siens
  const champ = (nom, max = 200) => String(d[nom] ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  if (champ("site")) return json({ ok: true });  // le champ piège est rempli : un robot, on ne transmet rien
  const prenom = champ("prenom", 80), email = champ("email", 120), projet = champ("projet", 60) || "Autre chose";
  if (!prenom || !/^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(email)) return json({ ok: false }, 400);
  const si = (nom, libelle, max) => (champ(nom, max) ? `${libelle} : ${champ(nom, max)}` : false);
  const lignes = [
    `Prénom : ${prenom}`,
    `E-mail : ${email}`,
    si("telephone", "Téléphone", 40),
    `Envie : ${projet}`,
    si("parcours", "Parcours", 40),
    si("date", "Disponibilités", 200),
    si("personnes", "Nombre de personnes", 20),
    "",
    String(d.message ?? "").trim().slice(0, 4000) || "(pas de message)",
    "",
    "Pour lui répondre : « Répondre », le mail part directement vers son adresse.",
  ].filter((ligne) => ligne !== false);
  const brut = [
    `From: ${enTete("Site Lumâ")} <site@lumamouvement.com>`,
    `To: ${BOITE}`,
    `Reply-To: ${email}`,
    `Subject: ${enTete(`Demande Lumâ : ${projet} (${prenom})`)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@lumamouvement.com>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(lignes.join("\r\n")).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");
  try {
    await env.COURRIER.send(new EmailMessage("site@lumamouvement.com", BOITE, brut));
  } catch (erreur) {
    return json({ ok: false }, 502);
  }
  return json({ ok: true });
}

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    if (url.protocol === "http:" || url.hostname.startsWith("www.")) {
      url.protocol = "https:";
      url.hostname = url.hostname.replace(/^www\./, "");
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/demande") return demande(requete, env);

    const nom = /^\/video\/([\w-]+\.mp4)$/.exec(url.pathname)?.[1];
    if (!nom) return env.ASSETS.fetch(requete);

    const fichier = await env.ASSETS.fetch(`${url.origin}/media/${nom}`);
    if (!fichier.ok) return fichier;
    const entetes = new Headers({
      "content-type": "video/mp4",
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=3600",
    });
    const etag = fichier.headers.get("etag");
    if (etag) entetes.set("etag", etag);

    // Sans demande de morceau : le fichier entier
    const plage = /^bytes=(\d*)-(\d*)$/.exec(requete.headers.get("range") || "");
    if (!plage || (plage[1] === "" && plage[2] === "")) return new Response(fichier.body, { headers: entetes });

    // Cloudflare ne donne pas la taille du fichier au Worker : on la mesure en le lisant
    const donnees = await fichier.arrayBuffer();
    const taille = donnees.byteLength;

    // Bornes du morceau : « bytes=debut-fin », « bytes=debut- » ou « bytes=-n » (les n derniers octets)
    let debut, fin;
    if (plage[1] === "") {
      debut = Math.max(0, taille - Number(plage[2]));
      fin = taille - 1;
    } else {
      debut = Number(plage[1]);
      fin = plage[2] === "" ? taille - 1 : Math.min(Number(plage[2]), taille - 1);
    }
    if (debut >= taille || debut > fin) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${taille}` } });
    }

    entetes.set("content-range", `bytes ${debut}-${fin}/${taille}`);
    return new Response(donnees.slice(debut, fin + 1), { status: 206, headers: entetes });
  },
};
