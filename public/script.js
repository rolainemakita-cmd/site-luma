// Adresse e-mail de contact de Luma
const CONTACT_EMAIL = "atelier.mouvement.luma@gmail.com";

// Barre de navigation : fond au scroll
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Menu mobile
const toggle = document.querySelector(".nav-toggle");
const menu = document.getElementById("menu");
toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!open));
  menu.classList.toggle("open", !open);
});
menu.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    toggle.setAttribute("aria-expanded", "false");
    menu.classList.remove("open");
  })
);

// Apparition des éléments au scroll
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 80}ms`;
  observer.observe(el);
});

// Lien e-mail
document.querySelectorAll("[data-email-link]").forEach((a) => {
  if (CONTACT_EMAIL) {
    a.href = `mailto:${CONTACT_EMAIL}`;
    a.textContent = CONTACT_EMAIL;
  }
});

// Formulaire de contact : ouvre la messagerie en attendant un vrai service d'envoi
const form = document.getElementById("contact-form");
const note = document.getElementById("form-note");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!CONTACT_EMAIL) {
    note.textContent = "Brouillon : l'adresse e-mail de Luma n'est pas encore configurée.";
    return;
  }
  const data = new FormData(form);
  const subject = `Luma : ${data.get("sujet")}`;
  const body = `${data.get("message")}\n\n${data.get("prenom")} (${data.get("email")})`;
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  note.textContent = "Ta messagerie s'ouvre pour envoyer le message.";
});
