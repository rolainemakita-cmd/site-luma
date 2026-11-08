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
// l'image d'accueil reste alors affichée). Si la musique joue, la vidéo reprend au bon moment de la boucle.
const banniere = document.querySelector(".accueil");
const videos = () => [...banniere.querySelectorAll("video")].filter((v) => v.offsetParent !== null);
let videoVisible = true;
const lancer = () => videos().forEach((v) => {
  if (source && v.readyState >= 1) v.currentTime = phase();
  v.play().catch(() => {});
});
new IntersectionObserver(([e]) => {
  videoVisible = e.isIntersecting;
  if (videoVisible) lancer(); else banniere.querySelectorAll("video").forEach((v) => v.pause());
  afficherSon();
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

// La musique (« Smooth Rnb Beat », Tunetank) accompagne toute la visite, dès l'arrivée sur le site.
// Les navigateurs ne laissent sortir le son qu'après un premier geste (un clic, un toucher, une touche ;
// pas le défilement) : on essaie dès le chargement, sinon elle part au premier geste, n'importe où sur la page.
// La boucle de 4 mesures tourne dans l'AudioContext, sans couture ; à chaque tour, la vidéo repart de 0
// au moment où le début de la boucle sort des haut-parleurs : les coupes de la vidéo tombent sur les temps.
// « Couper le son » l'arrête pour la visite (retenu le temps de la session) ; page cachée : pause, puis reprise.
const boutonSon = banniere.querySelector(".son");
const texteSon = boutonSon.querySelector(".son-texte");
let contexte = null, tampon = null, source = null, volume = null, minuterie = null, t0 = 0;
const memoire = (valeur) => {
  try {
    if (valeur) sessionStorage.setItem("luma-son", valeur);
    return sessionStorage.getItem("luma-son");
  } catch (e) { return null; }
};
let voulue = memoire() !== "coupe";  // la musique joue, sauf si la visiteuse l'a coupée

// Le bouton : « Couper le son » quand la musique joue ; hors de la bannière, il reste alors à l'écran
const afficherSon = () => {
  boutonSon.setAttribute("aria-pressed", String(!!source));
  texteSon.textContent = source ? "Couper le son" : "Le son";
  boutonSon.classList.toggle("flottant", !!source && !videoVisible);
};

// Heure (au sens de performance.now) à laquelle un instant de l'AudioContext sort des haut-parleurs
const heureSortie = (instant) => {
  const repere = contexte.getOutputTimestamp ? contexte.getOutputTimestamp() : {};
  if (repere.performanceTime) return repere.performanceTime + (instant - repere.contextTime) * 1000;
  return performance.now() + (instant - contexte.currentTime + (contexte.outputLatency || contexte.baseLatency || 0)) * 1000;
};
// Où en est la boucle, en secondes, à cet instant
const phase = () => {
  const ecoule = (performance.now() - heureSortie(t0)) / 1000;
  return ((ecoule % tampon.duration) + tampon.duration) % tampon.duration;
};
const caler = (tour) => {
  minuterie = setTimeout(() => {
    if (videoVisible) videos().forEach((v) => { v.currentTime = 0; v.play().catch(() => {}); });
    caler(tour + 1);
  }, Math.max(0, heureSortie(t0 + tour * tampon.duration) - performance.now()));
};

const jouer = () => {
  if (!voulue || source || !tampon || !contexte || contexte.state !== "running" || document.hidden) return;
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
  afficherSon();
  caler(0);
};

// Prépare la musique (une seule fois), puis réveille l'AudioContext. resume() part tout de suite :
// sur iPhone, il doit être appelé pendant le geste, avant toute attente.
const demarrer = () => {
  if (!contexte) {
    if (navigator.audioSession) navigator.audioSession.type = "playback";  // iPhone : le son passe même en mode silencieux
    contexte = new (window.AudioContext || window.webkitAudioContext)();
    contexte.addEventListener("statechange", jouer);
    fetch("media/musique-accueil.wav").then((reponse) => reponse.arrayBuffer())
      .then((donnees) => contexte.decodeAudioData(donnees))
      .then((musique) => { tampon = musique; jouer(); })
      .catch(() => {});
  }
  contexte.resume().then(jouer, () => {});
};

const arreter = () => {
  clearTimeout(minuterie);
  if (source) {
    const maintenant = contexte.currentTime, gain = volume.gain;
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(maintenant);
    else { gain.cancelScheduledValues(maintenant); gain.setValueAtTime(gain.value, maintenant); }
    gain.linearRampToValueAtTime(0, maintenant + 0.3);  // fondu de sortie
    source.stop(maintenant + 0.32);
    source = null;
  }
  afficherSon();
};

boutonSon.addEventListener("click", () => {
  voulue = !source;
  memoire(voulue ? "joue" : "coupe");
  if (voulue) demarrer(); else arreter();
});
// Au premier geste, n'importe où sauf sur le bouton (il décide lui-même), la musique part si elle n'a pas été coupée
["pointerup", "touchend", "click", "keydown"].forEach((type) => document.addEventListener(type, (evenement) => {
  if (voulue && !source && !boutonSon.contains(evenement.target)) demarrer();
}, { capture: true, passive: true }));
// Page cachée : la musique s'arrête ; de retour, elle reprend, sauf si la visiteuse l'a coupée
document.addEventListener("visibilitychange", () => { if (document.hidden) arreter(); else if (voulue) demarrer(); });
addEventListener("load", () => { if (voulue) demarrer(); });

// Réserver : le formulaire envoie la demande au site (/demande), qui la transmet à la boîte de Lumâ.
// Les boutons « Réserver » des formules y mènent, avec la bonne formule déjà choisie.
const formulaire = document.getElementById("formulaire-devis");
const etat = formulaire.querySelector(".formulaire-etat");
document.querySelectorAll("[data-projet]").forEach((lien) => lien.addEventListener("click", () => {
  formulaire.elements.projet.value = lien.dataset.projet;
  setTimeout(() => formulaire.elements.prenom.focus({ preventScroll: true }), 600);
}));
formulaire.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const champ = (nom) => formulaire.elements[nom].value.trim();
  const prenom = champ("prenom");
  if (!prenom) { formulaire.elements.prenom.focus(); return; }
  if (!champ("email") || !formulaire.elements.email.checkValidity()) {
    etat.textContent = "Ton e-mail, pour que je puisse te répondre.";
    formulaire.elements.email.focus();
    return;
  }
  const bouton = formulaire.querySelector('button[type="submit"]');
  bouton.disabled = true;
  etat.textContent = "Envoi en cours…";
  try {
    const reponse = await fetch("/demande", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(formulaire))),
    });
    if (!reponse.ok) throw new Error(String(reponse.status));
    formulaire.reset();
    etat.textContent = `Merci ${prenom} ! Ta demande est bien arrivée : je te réponds très vite.`;
  } catch (erreur) {
    etat.innerHTML = 'Le message n\'a pas pu partir : écris-moi à <a href="mailto:atelier.mouvement.luma@gmail.com">atelier.mouvement.luma@gmail.com</a> ou sur Instagram, je te réponds très vite.';
  } finally {
    bouton.disabled = false;
  }
});
