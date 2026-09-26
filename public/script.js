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

// Vidéos : lecture seulement quand elles sont visibles
const lecteur = new IntersectionObserver((entrees) => entrees.forEach((e) => {
  if (e.isIntersecting) e.target.play().catch(() => {});
  else e.target.pause();
}), { threshold: 0.05 });
document.querySelectorAll("video").forEach((v) => lecteur.observe(v));

// Vidéo d'accueil : quelques passages au ralenti, avec des transitions douces
const videoAccueil = document.querySelector(".accueil-video");
if (videoAccueil) {
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
}

