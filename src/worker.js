// Worker du site Lumâ.
// Les fichiers de public/ sont servis directement par Cloudflare, sans passer par ce script.
// Seules les adresses /video/... arrivent ici : la vidéo de public/media/ est renvoyée par
// morceaux (requêtes « Range »), sans quoi Safari sur iPhone et iPad refuse de la lire.
export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    const nom = /^\/video\/([\w-]+\.mp4)$/.exec(url.pathname)?.[1];
    if (!nom) return env.ASSETS.fetch(requete);

    const fichier = await env.ASSETS.fetch(`${url.origin}/media/${nom}`);
    const taille = Number(fichier.headers.get("content-length"));
    if (!fichier.ok || !fichier.body || !taille) return fichier;

    const entetes = new Headers({
      "content-type": "video/mp4",
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=3600",
    });
    const etag = fichier.headers.get("etag");
    if (etag) entetes.set("etag", etag);

    // Sans demande de morceau : le fichier entier
    const plage = /^bytes=(\d*)-(\d*)$/.exec(requete.headers.get("range") || "");
    if (!plage || (plage[1] === "" && plage[2] === "")) {
      entetes.set("content-length", String(taille));
      if (requete.method === "HEAD") { fichier.body.cancel(); return new Response(null, { headers: entetes }); }
      return new Response(fichier.body, { headers: entetes });
    }

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
      fichier.body.cancel();
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${taille}` } });
    }

    const longueur = fin - debut + 1;
    entetes.set("content-range", `bytes ${debut}-${fin}/${taille}`);
    entetes.set("content-length", String(longueur));
    if (requete.method === "HEAD") { fichier.body.cancel(); return new Response(null, { status: 206, headers: entetes }); }

    // On ne garde que les octets demandés, puis on arrête la lecture du fichier
    let position = 0;
    const decoupe = new TransformStream({
      transform(morceau, controleur) {
        const depart = position;
        position += morceau.byteLength;
        if (position > debut && depart <= fin) {
          controleur.enqueue(morceau.subarray(Math.max(0, debut - depart), Math.min(morceau.byteLength, fin + 1 - depart)));
        }
        if (position > fin) controleur.terminate();
      },
    });
    const { readable, writable } = new FixedLengthStream(longueur);
    fichier.body.pipeThrough(decoupe).pipeTo(writable).catch(() => {});
    return new Response(readable, { status: 206, headers: entetes });
  },
};
