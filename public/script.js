// En-tête : fond clair une fois la vidéo d'accueil passée
const entete = document.querySelector(".entete");
const accueil = document.querySelector(".accueil");
const barre = document.querySelector(".barre-mobile");
const reserver = document.getElementById("reserver");
const majEntete = () => {
  const passe = window.scrollY > accueil.offsetHeight - 80;
  entete.classList.toggle("pleine", passe);
  const avantReserver = window.scrollY + window.innerHeight < reserver.offsetTop + 120;
  barre.classList.toggle("visible", passe && avantReserver);
};
window.addEventListener("scroll", majEntete, { passive: true });
majEntete();

// Menu mobile
const burger = document.querySelector(".burger");
const menu = document.getElementById("menu");
burger.addEventListener("click", () => {
  const ouvert = burger.getAttribute("aria-expanded") === "true";
  burger.setAttribute("aria-expanded", String(!ouvert));
  menu.classList.toggle("ouvert", !ouvert);
  entete.classList.toggle("pleine", !ouvert || window.scrollY > accueil.offsetHeight - 80);
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

// Vidéo d'accueil : lecture seulement quand elle est visible. Si l'appareil refuse de la lancer
// (mode économie d'énergie de l'iPhone, réseau lent), l'image d'accueil bouge doucement à la place.
const videoAccueil = document.querySelector(".accueil-video");
let accueilVisible = true;
const lancerVideo = () => videoAccueil.play().catch(() => accueil.classList.add("accueil-fixe"));
new IntersectionObserver(([e]) => {
  accueilVisible = e.isIntersecting;
  if (accueilVisible) lancerVideo();
  else videoAccueil.pause();
}, { threshold: 0.05 }).observe(videoAccueil);
videoAccueil.addEventListener("playing", () => accueil.classList.remove("accueil-fixe"));
videoAccueil.querySelector("source").addEventListener("error", () => accueil.classList.add("accueil-fixe"));
setTimeout(() => { if (videoAccueil.paused || videoAccueil.readyState < 3) accueil.classList.add("accueil-fixe"); }, 4000);

// Nouvel essai après un toucher, un clic ou un retour sur la page (autorisé même en mode économie d'énergie)
const relancerVideo = () => { if (accueilVisible && !document.hidden && videoAccueil.paused) lancerVideo(); };
["touchend", "click"].forEach((type) => document.addEventListener(type, relancerVideo, { passive: true }));
document.addEventListener("visibilitychange", relancerVideo);

// Quelques passages au ralenti, avec des transitions douces
const ralentis = [[1.8, 3.8], [5.6, 7.4]];
setInterval(() => {
  const t = videoAccueil.currentTime;
  const cible = ralentis.some(([debut, fin]) => t >= debut && t < fin) ? 0.4 : 1;
  const actuel = videoAccueil.playbackRate;
  if (Math.abs(cible - actuel) > 0.01) {
    const pas = Math.sign(cible - actuel) * Math.min(0.12, Math.abs(cible - actuel));
    videoAccueil.playbackRate = Math.round((actuel + pas) * 100) / 100;
  }
}, 100);

