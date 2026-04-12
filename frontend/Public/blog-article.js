const blogArticleShell = document.getElementById("blogArticleShell");
const blogArticles = Array.isArray(window.BLOG_ARTICLES) ? window.BLOG_ARTICLES : [];

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getToneClass(article) {
    switch (article.heroTone) {
    case "tabua":
        return "blog-article-cover-tabua";
    case "madeira":
        return "blog-article-cover-madeira";
    default:
        return "blog-article-cover-cuia";
    }
}

function buildPaginationLink(article, isNext) {
    if (!article) {
        return "";
    }

    return `
        <a class="blog-article-pagination-link ${isNext ? "is-next" : "is-prev"}" href="/blog/${encodeURIComponent(article.slug || "")}">
            <span class="blog-article-pagination-label">
                ${isNext
        ? '<span>Próximo</span><i class="fa-solid fa-arrow-right"></i>'
        : '<i class="fa-solid fa-arrow-left"></i><span>Anterior</span>'}
            </span>
            <h3 class="blog-article-pagination-title">${escapeHtml(article.title || "Conteúdo")}</h3>
        </a>
    `;
}

function renderArticle() {
    if (!blogArticleShell) {
        return;
    }

    const slug = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() || "");
    const articleIndex = blogArticles.findIndex((item) => item.slug === slug);
    const article = articleIndex >= 0 ? blogArticles[articleIndex] : null;

    if (!article) {
        document.title = "Conteúdo não encontrado | Arteno";
        blogArticleShell.innerHTML = '<div class="blog-empty-state">Não encontramos este conteúdo. <a href="/blog">Voltar para o blog</a>.</div>';
        return;
    }

    const previousArticle = articleIndex > 0 ? blogArticles[articleIndex - 1] : null;
    const nextArticle = articleIndex < blogArticles.length - 1 ? blogArticles[articleIndex + 1] : null;

    document.title = `${article.title} | Arteno`;
    blogArticleShell.innerHTML = `
        <header class="blog-article-hero">
            <div class="blog-article-cover ${getToneClass(article)}">
                <span>${escapeHtml(article.category || "Blog")}</span>
            </div>
            <div class="blog-article-meta">
                <span>${escapeHtml(article.readTime || "Leitura rápida")}</span>
                <span>"</span>
                <span>Arteno</span>
            </div>
            <h1 class="blog-article-title">${escapeHtml(article.title || "Conteúdo")}</h1>
            <p class="blog-article-summary">${escapeHtml(article.excerpt || "")}</p>
        </header>
        <div class="blog-article-content">
            ${(article.sections || []).map((section) => `
                <section class="blog-article-section">
                    <h2>${escapeHtml(section.heading || "")}</h2>
                    ${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph || "")}</p>`).join("")}
                </section>
            `).join("")}
        </div>
        <nav class="blog-article-pagination">
            ${buildPaginationLink(previousArticle, false)}
            ${buildPaginationLink(nextArticle, true)}
        </nav>
    `;
}

renderArticle();
