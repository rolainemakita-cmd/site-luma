// Worker du site Lumâ.
// Les fichiers de public/ sont servis directement par Cloudflare, sans passer par ce script.
// N'arrivent ici que la page d'accueil (voir run_worker_first dans wrangler.jsonc) et les adresses /video/...
// - la page d'accueil demandée en http:// ou sur www. est renvoyée vers https://lumamouvement.com
//   (sinon les navigateurs affichent « Non sécurisé ») ;
// - la vidéo de public/media/ est renvoyée par morceaux (requêtes « Range »), sans quoi
//   Safari sur iPhone et iPad refuse de la lire.
export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    if (url.protocol === "http:" || url.hostname.startsWith("www.")) {
      url.protocol = "https:";
      url.hostname = url.hostname.replace(/^www\./, "");
      return Response.redirect(url.toString(), 301);
    }

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
