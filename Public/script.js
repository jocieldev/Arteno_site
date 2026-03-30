
const menuIcon = document.querySelector(".menu-icon");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const closeMenu = document.getElementById("closeMenu");

menuIcon.addEventListener("click", () => {
    sideMenu.classList.add("active");
    overlay.classList.add("active");
});

function closeSideMenu() {
    sideMenu.classList.remove("active");
    overlay.classList.remove("active");
}

closeMenu.addEventListener("click", closeSideMenu);
overlay.addEventListener("click", closeSideMenu);



const produtos = document.getElementById("abrir-submenu");

produtos.addEventListener('click', () => {
    produtos.classList.toggle('ativo');
});








const swiper = new Swiper(".mySwiper", {

    slidesPerView: 1,
    spaceBetween: 20,

    pagination: {
        el: ".swiper-pagination",
        clickable: true,
        enabled: true // 🔥 força ativação no mobile
    },

    navigation: {
        nextEl: ".swiper-button-next",
        prevEl: ".swiper-button-prev",
        enabled: false // 🔥 desativa no mobile
    },

    breakpoints: {

        991: {
            slidesPerView: 3,
            slidesPerGroup: 3,

            pagination: {
                enabled: false
            },

            navigation: {
                enabled: true
            }
        },

        1198: {
            slidesPerView: 4,
            slidesPerGroup: 4,

            pagination: {
                enabled: false
            },

            navigation: {
                enabled: true
            }
        }
    }
});

var categories = new Swiper(".produtosSwiper", {
    grabCursor: true,

    // 📱 Celular
    slidesPerView: 3,

    pagination: {
        el: ".swiper-pagination",
        clickable: true,
    },

    breakpoints: {
        768: {
            slidesPerView: "auto",  // 👈 importante
            allowTouchMove: false
        }
    }
});

var productCards = new Swiper(".productCardsSwiper", {
    loop: true,
    slidesPerView: 2,
    slidesPerGroup: 1,
    spaceBetween: 15,
    observer: true,
    observeParents: true,
    updateOnWindowResize: true,
    watchOverflow: true,
    pagination: {
        el: ".product-cards-pagination",
        clickable: true,
    },
    navigation: {
        nextEl: ".product-cards-next",
        prevEl: ".product-cards-prev",
    },
    breakpoints: {
        0: {
            slidesPerView: 2,
            spaceBetween: 15
        },
        640: {
            slidesPerView: 2,
            spaceBetween: 15
        },
        992: {
            slidesPerView: 3,
            spaceBetween: 15
        }
    }
});

const faqItems = document.querySelectorAll(".faq-item");

faqItems.forEach((item) => {
    const button = item.querySelector(".faq-question");

    button.addEventListener("click", () => {
        const isActive = item.classList.contains("active");

        faqItems.forEach((faqItem) => {
            faqItem.classList.remove("active");
            faqItem.querySelector(".faq-question").setAttribute("aria-expanded", "false");
        });

        if (!isActive) {
            item.classList.add("active");
            button.setAttribute("aria-expanded", "true");
        }
    });
});

const elementos = document.querySelectorAll(".animar");

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("ativo");
        } else {
            entry.target.classList.remove("ativo");
            // 🔥 remove se sair da tela (para animar toda vez)
        }
    });
}, {
    threshold: 0.2
});

elementos.forEach(el => observer.observe(el));
