// Le script ne cache les blocs (pour leur apparition douce) que s'il tourne vraiment.
document.documentElement.classList.add("js");

// Menu mobile
const burger = document.querySelector(".burger");
const menu = document.getElementById("menu");
burger.addEventListener("click", () => {
  const ouvert = burger.getAttribute("aria-expanded") === "true";
  burger.setAttribute("aria-expanded", String(!ouvert));
  menu.classList.toggle("ouvert", !ouvert);
});
menu.querySelectorAll("a").forEach((lien) => lien.addEventListener("click", () => {
  burger.setAttribute("aria-expanded", "false");
  menu.classList.remove("ouvert");
}));

// Apparition douce au défilement
const observateur = new IntersectionObserver((entrees) => entrees.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add("vu"); observateur.unobserve(e.target); }
}), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
document.querySelectorAll(".revele").forEach((el) => observateur.observe(el));

// La vidéo de la bannière : lecture seulement quand la bannière est visible ;
// nouvel essai après un toucher (en mode économie d'énergie, l'iPhone refuse la lecture automatique :
// l'image d'accueil reste alors affichée).
const banniere = document.querySelector(".accueil");
const videos = () => [...banniere.querySelectorAll("video")].filter((v) => v.offsetParent !== null);
let videoVisible = true;
const lancer = () => videos().forEach((v) => v.play().catch(() => {}));
new IntersectionObserver(([e]) => {
  videoVisible = e.isIntersecting;
  if (videoVisible) lancer(); else banniere.querySelectorAll("video").forEach((v) => v.pause());
}, { threshold: 0.05 }).observe(banniere);
const relancer = () => { if (videoVisible && !document.hidden && videos().some((v) => v.paused)) lancer(); };
["touchend", "click"].forEach((type) => document.addEventListener(type, relancer, { passive: true }));
document.addEventListener("visibilitychange", relancer);

// L'ambiance floutée : une petite toile (au quart de sa taille, le flou du CSS fait le reste) repeinte à chaque image
// de la vidéo nette. La vidéo y est à sa place exacte, prolongée de chaque côté par son reflet en miroir :
// au bord de la vidéo nette, les couleurs se suivent. Avant la première image, l'image d'accueil la remplace.
const toile = banniere.querySelector(".accueil-ambiance canvas");
const nette = banniere.querySelector(".accueil-reel video");
const pinceau = toile.getContext("2d");
const affiche = new Image();
affiche.src = nette.poster;
const peindre = () => {
  if (toile.offsetParent === null) return;  // sur téléphone, l'ambiance est masquée
  const zone = toile.getBoundingClientRect(), cadre = nette.getBoundingClientRect();
  const largeur = Math.ceil(zone.width / 4), hauteur = Math.ceil(zone.height / 4);
  if (toile.width !== largeur || toile.height !== hauteur) { toile.width = largeur; toile.height = hauteur; }
  const image = nette.readyState >= 2 ? nette : affiche;
  const iw = image.videoWidth || image.naturalWidth, ih = image.videoHeight || image.naturalHeight;
  if (!iw || !cadre.width) return;
  const kx = largeur / zone.width, ky = hauteur / zone.height;
  const echelle = Math.max(cadre.width / iw, cadre.height / ih);  // comme object-fit: cover
  const l = iw * echelle * kx, h = ih * echelle * ky;
  const x0 = (cadre.left + (cadre.width - iw * echelle) / 2 - zone.left) * kx;
  const y = (cadre.top + (cadre.height - ih * echelle) / 2 - zone.top) * ky;
  for (let i = Math.floor(-x0 / l); x0 + i * l < largeur; i++) {
    const x = x0 + i * l;
    if (i % 2 === 0) pinceau.drawImage(image, x, y, l, h);  // la vidéo, à l'endroit
    else {  // son reflet
      pinceau.save(); pinceau.translate(x + l, y); pinceau.scale(-1, 1);
      pinceau.drawImage(image, 0, 0, l, h); pinceau.restore();
    }
  }
};
affiche.addEventListener("load", peindre);
["loadeddata", "seeked"].forEach((type) => nette.addEventListener(type, peindre));
new ResizeObserver(peindre).observe(banniere);
if (nette.requestVideoFrameCallback) {
  const aChaqueImage = () => { peindre(); nette.requestVideoFrameCallback(aChaqueImage); };
  nette.requestVideoFrameCallback(aChaqueImage);
} else {
  const boucle = () => { if (!nette.paused) peindre(); requestAnimationFrame(boucle); };
  requestAnimationFrame(boucle);
}

// La musique de la bannière (« Smooth Rnb Beat », Tunetank) : chargée seulement au premier clic sur « Le son ».
// La boucle de 4 mesures tourne dans l'AudioContext, sans couture ; à chaque tour, les vidéos repartent de 0
// au moment où le début de la boucle sort des haut-parleurs : les coupes de la vidéo tombent sur les temps.
const boutonSon = banniere.querySelector(".son");
const texteSon = boutonSon.querySelector(".son-texte");
let contexte = null, tampon = null, source = null, volume = null, minuterie = null, t0 = 0;
const sonActif = () => boutonSon.getAttribute("aria-pressed") === "true";

// Heure (au sens de performance.now) à laquelle un instant de l'AudioContext sort des haut-parleurs
const heureSortie = (instant) => {
  const repere = contexte.getOutputTimestamp ? contexte.getOutputTimestamp() : {};
  if (repere.performanceTime) return repere.performanceTime + (instant - repere.contextTime) * 1000;
  return performance.now() + (instant - contexte.currentTime + (contexte.outputLatency || contexte.baseLatency || 0)) * 1000;
};
const caler = (tour) => {
  minuterie = setTimeout(() => {
    videos().forEach((v) => { v.currentTime = 0; v.play().catch(() => {}); });
    caler(tour + 1);
  }, Math.max(0, heureSortie(t0 + tour * tampon.duration) - performance.now()));
};

const lancerSon = async () => {
  boutonSon.setAttribute("aria-pressed", "true");
  texteSon.textContent = "Couper le son";
  if (!contexte) {
    if (navigator.audioSession) navigator.audioSession.type = "playback";  // iPhone : le son passe même en mode silencieux
    contexte = new (window.AudioContext || window.webkitAudioContext)();
  }
  await contexte.resume();
  if (!tampon) tampon = await contexte.decodeAudioData(await (await fetch("media/musique-accueil.wav")).arrayBuffer());
  if (!sonActif() || source) return;  // coupé pendant le chargement, ou déjà lancé
  volume = contexte.createGain();
  volume.connect(contexte.destination);
  source = contexte.createBufferSource();
  source.buffer = tampon;
  source.loop = true;
  source.connect(volume);
  t0 = contexte.currentTime + 0.15;
  volume.gain.setValueAtTime(0, contexte.currentTime);
  volume.gain.setValueAtTime(0, t0);
  volume.gain.linearRampToValueAtTime(1, t0 + 0.4);  // montée douce
  source.start(t0);
  caler(0);
};

const couperSon = () => {
  boutonSon.setAttribute("aria-pressed", "false");
  texteSon.textContent = "Le son";
  clearTimeout(minuterie);
  if (!source) return;
  const maintenant = contexte.currentTime, gain = volume.gain;
  if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(maintenant);
  else { gain.cancelScheduledValues(maintenant); gain.setValueAtTime(gain.value, maintenant); }
  gain.linearRampToValueAtTime(0, maintenant + 0.3);  // fondu de sortie
  source.stop(maintenant + 0.32);
  source = null;
};

boutonSon.addEventListener("click", () => { if (sonActif()) couperSon(); else lancerSon().catch(couperSon); });
// La musique s'arrête quand la bannière sort de l'écran ou que la page passe à l'arrière-plan
new IntersectionObserver(([e]) => { if (!e.isIntersecting && sonActif()) couperSon(); }, { threshold: 0.05 }).observe(banniere);
document.addEventListener("visibilitychange", () => { if (document.hidden && sonActif()) couperSon(); });

// La demande spéciale : le formulaire prépare un mail, prêt à partir depuis la messagerie de la personne.
const formulaire = document.getElementById("formulaire-devis");
formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const champ = (nom) => formulaire.elements[nom].value.trim();
  const prenom = champ("prenom");
  if (!prenom) { formulaire.elements.prenom.focus(); return; }
  const lignes = [
    `Bonjour Rolaine,`,
    ``,
    `Mon projet : ${champ("projet")}`,
    champ("date") && `La date souhaitée : ${champ("date")}`,
    champ("personnes") && `Le nombre de personnes : ${champ("personnes")}`,
    ``,
    champ("message"),
    ``,
    prenom,
  ].filter((ligne) => ligne !== false && ligne !== undefined);
  const sujet = `Demande spéciale Lumâ : ${champ("projet").toLowerCase()}`;
  window.location.href = `mailto:atelier.mouvement.luma@gmail.com?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(lignes.join("\n"))}`;
});
